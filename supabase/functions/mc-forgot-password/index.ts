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
      from: "Prestige Bella Vista <pbv.mc.2527@gmail.com>",
      reply_to: "pbv.mc.2527@gmail.com",
      to: [mcUser.email],
      subject: "Prestige Bella Vista - Password Reset",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">🔐 Password Reset</h1>
            <p style="color: #f0e6d3; margin: 10px 0 0 0;">Prestige Bella Vista MC Portal</p>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e0d6c8; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">Dear <strong>${mcUser.name}</strong>,</p>
            
            <p style="color: #555; line-height: 1.6;">Your password has been reset as requested. Please use the following credentials to log in:</p>
            
            <div style="background: #f8f4f0; border: 2px solid #8B4513; border-radius: 10px; padding: 20px; margin: 25px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #666; width: 40%;">Username:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #333; font-family: monospace;">${mcUser.login_username}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666;">New Temporary Password:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #333; font-family: monospace;">${tempPassword}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #856404; background: #fff3cd; padding: 15px; border-radius: 8px; font-size: 14px;">
              ⚠️ You will be prompted to change your password after logging in.
            </p>
            
            <p style="color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 8px; font-size: 14px; margin-top: 15px;">
              🚨 If you did not request this reset, please reply to this email immediately.
            </p>
            
            <p style="margin-top: 30px; color: #333;">
              Warm regards,<br>
              <strong>Treasurer</strong><br>
              <span style="color: #8B4513;">Prestige Bella Vista Management</span>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
            <p>This is an automated message from Prestige Bella Vista Society Portal</p>
          </div>
        </div>
      `,
    });

    console.log("Password reset email send result:", emailResponse);
    if ((emailResponse as any)?.error) {
      console.error("Resend password reset email error:", (emailResponse as any).error);
      throw new Error((emailResponse as any).error?.message || "Failed to send password reset email");
    }

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