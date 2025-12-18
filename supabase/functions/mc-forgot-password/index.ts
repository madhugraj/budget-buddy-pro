import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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

    const { email } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Find MC user by email
    const { data: mcUser, error: findError } = await supabase
      .from("mc_users")
      .select("*")
      .eq("email", email)
      .eq("status", "approved")
      .single();

    if (findError || !mcUser) {
      // Don't reveal if email exists or not
      console.log("MC user not found or not approved for email:", email);
      return new Response(
        JSON.stringify({ success: true, message: "If the email is registered, a reset email will be sent." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate new temp password
    const tempPassword = generateTempPassword();

    // Update MC user with new temp password
    const { error: updateError } = await supabase
      .from("mc_users")
      .update({ temp_password: tempPassword })
      .eq("id", mcUser.id);

    if (updateError) {
      console.error("Error updating temp password:", updateError);
      throw new Error("Failed to reset password");
    }

    // Send password reset email
    const emailResponse = await resend.emails.send({
      from: "Society Portal <onboarding@resend.dev>",
      to: [mcUser.email],
      subject: "MC Portal - Password Reset",
      html: `
        <h2>Password Reset Request</h2>
        <p>Dear ${mcUser.name},</p>
        <p>Your password has been reset. Use the following temporary credentials to login:</p>
        <p><strong>Username:</strong> ${mcUser.login_username}</p>
        <p><strong>New Temporary Password:</strong> ${tempPassword}</p>
        <p><em>You will be prompted to change your password after logging in.</em></p>
        <p>If you did not request this reset, please contact the administration immediately.</p>
        <p>Best regards,<br>Society Administration</p>
      `,
    });

    console.log("Password reset email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in mc-forgot-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);