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
    const { message, userId, userRole, roleContext, history } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch relevant data based on user role
    let contextData = "";

    // Get current fiscal year in FY format (e.g., FY25-26)
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    // Fiscal year runs April to March. If we're in Jan 2026, it's FY25-26
    const fiscalStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fiscalEndYear = fiscalStartYear + 1;
    const fiscalYear = `FY${String(fiscalStartYear).slice(-2)}-${String(fiscalEndYear).slice(-2)}`;

    // Fetch expenses summary
    const { data: expenses } = await supabase
      .from("expenses")
      .select(`
        id, amount, gst_amount, description, expense_date, status, budget_master_id
      `)
      .gte("expense_date", `${fiscalStartYear}-04-01`)
      .order("expense_date", { ascending: false })
      .limit(100);

    // Fetch budget master for expense names
    const { data: budgetMaster } = await supabase
      .from("budget_master")
      .select("*")
      .eq("fiscal_year", fiscalYear);

    // Create lookup map
    const budgetMap = new Map((budgetMaster || []).map((b: any) => [b.id, b]));

    // Fetch income categories first
    const { data: incomeCategories } = await supabase
      .from("income_categories")
      .select("*")
      .eq("is_active", true);

    const categoryMap = new Map((incomeCategories || []).map((c: any) => [c.id, c]));

    // Fetch income summary with ALL entries for current fiscal year
    const { data: incomeActuals } = await supabase
      .from("income_actuals")
      .select(`id, actual_amount, gst_amount, month, status, fiscal_year, category_id`)
      .eq("fiscal_year", fiscalYear)
      .order("month", { ascending: false });

    // Fetch CAM tracking summary
    const { data: camTracking } = await supabase
      .from("cam_tracking")
      .select("*")
      .eq("year", fiscalStartYear)
      .order("month", { ascending: false });

    // Fetch petty cash summary
    const { data: pettyCash } = await supabase
      .from("petty_cash")
      .select("*")
      .order("date", { ascending: false })
      .limit(50);

    // Fetch user profiles for communication
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    // Group income by category for better context
    const incomeByCategoryMap = new Map<string, { category: string, subcategory: string | null, total: number, entries: any[] }>();
    (incomeActuals || []).forEach((i: any) => {
      const cat = categoryMap.get(i.category_id);
      const key = cat?.category_name || 'Unknown';
      if (!incomeByCategoryMap.has(key)) {
        incomeByCategoryMap.set(key, { category: key, subcategory: null, total: 0, entries: [] });
      }
      const group = incomeByCategoryMap.get(key)!;
      group.total += i.actual_amount || 0;
      group.entries.push({ month: i.month, amount: i.actual_amount, subcategory: cat?.subcategory_name, status: i.status });
    });

    const incomeByCategory = Array.from(incomeByCategoryMap.values());

    // Build context
    contextData = `
CURRENT FISCAL YEAR: ${fiscalYear}
CURRENT DATE: ${new Date().toISOString().split("T")[0]}

EXPENSE SUMMARY (Recent ${expenses?.length || 0} entries):
${expenses?.slice(0, 20).map((e: any) => {
  const budget = budgetMap.get(e.budget_master_id);
  return `- ${e.expense_date}: ${budget?.item_name || 'Unknown'} - ₹${e.amount} (Status: ${e.status})`;
}).join("\n") || "No expenses found"}

Total Expenses: ₹${expenses?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0).toLocaleString()}

INCOME CATEGORIES AVAILABLE:
${incomeCategories?.map((c: any) => `- ${c.category_name}${c.subcategory_name ? ` > ${c.subcategory_name}` : ''}`).join("\n") || "No categories"}

INCOME SUMMARY BY CATEGORY (${incomeActuals?.length || 0} total entries):
${incomeByCategory.map((g: any) => {
  const entrySummary = g.entries.slice(0, 5).map((e: any) => 
    `  - Month ${e.month}: ₹${e.amount?.toLocaleString()}${e.subcategory ? ` (${e.subcategory})` : ''}`
  ).join("\n");
  return `${g.category}: Total ₹${g.total.toLocaleString()}\n${entrySummary}`;
}).join("\n\n") || "No income found"}

BUDGET ITEMS (${budgetMaster?.length || 0} items):
${budgetMaster?.slice(0, 15).map((b: any) => 
  `- ${b.item_name} (${b.category}): Annual ₹${b.annual_budget.toLocaleString()}`
).join("\n") || "No budget items"}

CAM TRACKING:
${camTracking?.slice(0, 10).map((c: any) => 
  `- ${c.tower} (${c.month}/${c.year}): Paid ${c.paid_flats}/${c.total_flats} flats (Status: ${c.status})`
).join("\n") || "No CAM data"}

PETTY CASH (Recent):
${pettyCash?.slice(0, 10).map((p: any) => 
  `- ${p.date}: ${p.item_name} - ₹${p.amount} (Status: ${p.status})`
).join("\n") || "No petty cash entries"}

TEAM MEMBERS:
${profiles?.map((p: any) => {
  const role = userRoles?.find((r: any) => r.user_id === p.id)?.role || 'staff';
  return `- ${p.full_name || p.email} (${role})`;
}).join("\n") || "No team members"}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an AI assistant for the Budget Buddy expense management system.
${roleContext}

You have access to the following data:
${contextData}

CAPABILITIES:
1. Answer questions about expenses, income, budgets, CAM tracking, and petty cash
2. Help users verify if they made specific entries
3. Provide summaries and insights
4. When user wants to send a message to another team member, acknowledge and format the message request

GUIDELINES:
- Be concise and helpful
- Use ₹ for currency
- Format numbers with commas for readability
- If data is not found, clearly state so
- For communication requests, format as: "[TO: role/name] Message: content"
- Reference specific data when answering queries
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((h: any) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const reply = aiResponse.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Staff AI chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
