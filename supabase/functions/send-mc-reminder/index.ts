import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmailViaGmail(to: string, subject: string, htmlContent: string): Promise<void> {
  const gmailUser = "pbv.mc.2527@gmail.com";
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gmailAppPassword) {
    throw new Error("GMAIL_APP_PASSWORD not configured");
  }

  console.log(`Sending reminder email to: ${to}`);

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: gmailUser,
        password: gmailAppPassword.replace(/\s/g, ''),
      },
    },
  });

  const cleanHtml = htmlContent.replace(/>\s+</g, '><').replace(/\n\s*/g, '');

  await client.send({
    from: gmailUser,
    to: to,
    subject: subject,
    content: "Please view this email in an HTML-capable email client.",
    html: cleanHtml,
  });

  await client.close();
  console.log(`Reminder email sent successfully to: ${to}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mc_user_id, send_all } = await req.json();

    let usersToRemind: any[] = [];

    if (send_all) {
      // Get all approved users who haven't set their password
      const { data, error } = await supabase
        .from("mc_users")
        .select("*")
        .eq("status", "approved")
        .is("password_hash", null)
        .not("temp_password", "is", null);

      if (error) throw error;
      usersToRemind = data || [];
    } else if (mc_user_id) {
      // Get specific user
      const { data, error } = await supabase
        .from("mc_users")
        .select("*")
        .eq("id", mc_user_id)
        .eq("status", "approved")
        .is("password_hash", null)
        .single();

      if (error) throw error;
      if (data) usersToRemind = [data];
    }

    if (usersToRemind.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No users pending password setup", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const baseUrl = req.headers.get("origin") || "https://pbv-mc-portal.lovable.app";
    let sentCount = 0;
    const errors: string[] = [];

    for (const user of usersToRemind) {
      try {
        // Generate a new password reset token
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const { error: updateError } = await supabase
          .from("mc_users")
          .update({
            password_reset_token: token,
            password_reset_expires_at: expiresAt.toISOString(),
          })
          .eq("id", user.id);

        if (updateError) {
          console.error(`Failed to update token for ${user.email}:`, updateError);
          errors.push(`${user.name}: Failed to generate token`);
          continue;
        }

        const passwordSetupUrl = `${baseUrl}/mc-set-password?token=${token}`;

        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0;">
              <h1 style="margin:0;font-size:24px;">Reminder: Complete Your Registration</h1>
            </div>
            <div style="background:#f9fafb;padding:30px;border-radius:0 0 10px 10px;">
              <p style="font-size:16px;color:#374151;">Dear ${user.name},</p>
              <p style="font-size:14px;color:#6b7280;line-height:1.6;">
                We noticed you haven't completed your MC Portal account setup yet. Your account has been approved, 
                but you need to set your password to start using the portal.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${passwordSetupUrl}" style="background:#667eea;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                  Set Your Password Now
                </a>
              </div>
              <p style="font-size:12px;color:#9ca3af;text-align:center;">
                This link will expire in 7 days. If you have any issues, please contact the administration.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
              <p style="font-size:12px;color:#9ca3af;text-align:center;">
                Prestige Bella Vista MC Portal
              </p>
            </div>
          </div>
        `;

        await sendEmailViaGmail(user.email, "Reminder: Complete Your MC Portal Registration", emailHtml);
        sentCount++;
      } catch (emailError: any) {
        console.error(`Failed to send reminder to ${user.email}:`, emailError);
        errors.push(`${user.name}: ${emailError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: usersToRemind.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-mc-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
