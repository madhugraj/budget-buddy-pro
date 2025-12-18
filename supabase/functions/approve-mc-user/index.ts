import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApproveRequest {
  mc_user_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateUsername(name: string, unitNo: string): string {
  // Format: Name-UnitNo@mc-2527
  const cleanName = name.split(' ')[0].charAt(0).toUpperCase() + name.split(' ')[0].slice(1).toLowerCase();
  return `${cleanName}-${unitNo}@mc-2527`;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requester is a treasurer
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user has treasurer role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "treasurer") {
      throw new Error("Only treasurers can approve MC users");
    }

    const { mc_user_id, action, rejection_reason }: ApproveRequest = await req.json();

    // Get MC user details
    const { data: mcUser, error: mcError } = await supabase
      .from("mc_users")
      .select("*")
      .eq("id", mc_user_id)
      .single();

    if (mcError || !mcUser) {
      throw new Error("MC user not found");
    }

    if (mcUser.status !== "pending") {
      throw new Error("MC user is not in pending status");
    }

    if (action === "reject") {
      // Reject the MC user
      const { error: updateError } = await supabase
        .from("mc_users")
        .update({
          status: "rejected",
          rejection_reason: rejection_reason || "Application rejected by admin",
        })
        .eq("id", mc_user_id);

      if (updateError) throw updateError;

      // Send rejection email
      await resend.emails.send({
        from: "Society Portal <onboarding@resend.dev>",
        to: [mcUser.email],
        subject: "MC Registration Status Update",
        html: `
          <h2>MC Registration Update</h2>
          <p>Dear ${mcUser.name},</p>
          <p>We regret to inform you that your MC registration has not been approved.</p>
          ${rejection_reason ? `<p><strong>Reason:</strong> ${rejection_reason}</p>` : ''}
          <p>If you have any questions, please contact the society administration.</p>
          <p>Best regards,<br>Society Administration</p>
        `,
      });

      return new Response(
        JSON.stringify({ success: true, message: "MC user rejected" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Approve the MC user
    const tempPassword = generateTempPassword();
    const username = generateUsername(mcUser.name, mcUser.unit_no);

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from("mc_users")
      .select("id")
      .eq("login_username", username)
      .single();

    let finalUsername = username;
    if (existingUser) {
      // Append a random suffix if username exists
      finalUsername = `${username.replace('@mc-2527', '')}-${Date.now().toString(36)}@mc-2527`;
    }

    const { error: updateError } = await supabase
      .from("mc_users")
      .update({
        status: "approved",
        login_username: finalUsername,
        temp_password: tempPassword,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", mc_user_id);

    if (updateError) throw updateError;

    // Send approval email with credentials
    const emailResponse = await resend.emails.send({
      from: "Society Portal <onboarding@resend.dev>",
      to: [mcUser.email],
      subject: "MC Registration Approved - Your Login Credentials",
      html: `
        <h2>Welcome to the Management Committee!</h2>
        <p>Dear ${mcUser.name},</p>
        <p>Your MC registration has been approved. You can now access the MC portal.</p>
        <h3>Your Login Credentials:</h3>
        <p><strong>Username:</strong> ${finalUsername}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        <p><em>Please change your password after your first login.</em></p>
        <h3>Your Interest Groups:</h3>
        <ul>
          ${mcUser.interest_groups.map((g: string) => `<li>${g}</li>`).join('')}
        </ul>
        <p>Login at the MC Sign In section of the portal.</p>
        <p>Best regards,<br>Society Administration</p>
      `,
    });

    console.log("Approval email sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "MC user approved",
        username: finalUsername 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in approve-mc-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);