import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, conversationHistory } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: "Message and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client to fetch data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch relevant data for context
    const [
      { data: expenses },
      { data: incomeActuals },
      { data: incomeCategories },
      { data: budgetMaster },
      { data: camTracking },
      { data: mcUsers },
    ] = await Promise.all([
      supabase.from("expenses").select("*").eq("status", "approved").order("expense_date", { ascending: false }).limit(100),
      supabase.from("income_actuals").select("*, income_categories(*)").eq("status", "approved").limit(100),
      supabase.from("income_categories").select("*").eq("is_active", true),
      supabase.from("budget_master").select("*").limit(100),
      supabase.from("cam_tracking").select("*").order("year", { ascending: false }).limit(50),
      supabase.from("mc_users").select("id, name, tower_no, unit_no, email, interest_groups").eq("status", "approved"),
    ]);

    // Prepare data summaries for the AI
    const expenseSummary = expenses?.reduce((acc: Record<string, number>, exp) => {
      const category = exp.description || "Other";
      acc[category] = (acc[category] || 0) + (exp.amount || 0);
      return acc;
    }, {}) || {};

    const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;
    
    const incomeSummary = incomeActuals?.reduce((acc: Record<string, number>, inc) => {
      const category = inc.income_categories?.category_name || "Other";
      acc[category] = (acc[category] || 0) + (inc.actual_amount || 0);
      return acc;
    }, {}) || {};

    const totalIncome = incomeActuals?.reduce((sum, inc) => sum + (inc.actual_amount || 0), 0) || 0;

    const budgetSummary = budgetMaster?.reduce((acc: Record<string, { annual: number; monthly: number }>, item) => {
      acc[item.item_name] = {
        annual: item.annual_budget,
        monthly: item.monthly_budget,
      };
      return acc;
    }, {}) || {};

    const camSummary = camTracking?.map(cam => ({
      tower: cam.tower,
      month: cam.month,
      year: cam.year,
      paid_flats: cam.paid_flats,
      pending_flats: cam.pending_flats,
      total_flats: cam.total_flats,
    })) || [];

    const mcContacts = mcUsers?.map(u => ({
      name: u.name,
      tower: u.tower_no,
      unit: u.unit_no,
      email: u.email,
      interests: u.interest_groups,
    })) || [];

    const systemPrompt = `You are a helpful AI assistant for Prestige Bella Vista society's MC (Managing Committee) portal. You have access to financial and member data and can answer questions about:

1. **Expenses**: Total expenses, category-wise breakdown, specific expense items
2. **Income**: Income sources, CAM collections, rental income, sports income
3. **Budget**: Annual and monthly budgets for various items
4. **CAM Tracking**: Tower-wise CAM collection status
5. **MC Members**: Contact information for approved MC members

## Current Data Summary:

### Expenses (Approved):
- Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
- Category-wise breakdown: ${JSON.stringify(expenseSummary, null, 2)}

### Income (Approved):
- Total Income: ₹${totalIncome.toLocaleString('en-IN')}
- Category-wise breakdown: ${JSON.stringify(incomeSummary, null, 2)}

### Budget Items:
${JSON.stringify(budgetSummary, null, 2)}

### CAM Collection Status:
${JSON.stringify(camSummary.slice(0, 20), null, 2)}

### MC Members Directory:
${JSON.stringify(mcContacts, null, 2)}

## Guidelines:
- Always format currency in Indian Rupees (₹) with proper formatting
- Be concise but informative
- If asked about specific items not in the data, politely say you don't have that information
- For contact requests, provide email and tower/unit info
- You can suggest relevant follow-up questions
- Be friendly and professional`;

    // Build messages array with conversation history
    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that request.";

    // Store the conversation in database
    const { error: insertError } = await supabase.from("mc_ai_chat_history").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: aiResponse },
    ]);

    if (insertError) {
      console.error("Failed to store chat history:", insertError);
    }

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in mc-ai-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
