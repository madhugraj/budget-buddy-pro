import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApproveRequest {
  mc_user_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateUsername(name: string, unitNo: string): string {
  const cleanName = name.split(' ')[0].charAt(0).toUpperCase() + name.split(' ')[0].slice(1).toLowerCase();
  return `${cleanName}-${unitNo}@mc-2527`;
}

async function sendEmailViaGmail(to: string, subject: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  const gmailUser = "pbv.mc.2527@gmail.com";
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gmailAppPassword) {
    return { success: false, error: "Gmail App Password not configured" };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword.replace(/\s/g, ''), // Remove spaces from app password
        },
      },
    });

    await client.send({
      from: gmailUser,
      to: to,
      subject: subject,
      content: "Please view this email in an HTML-capable email client.",
      html: htmlContent,
    });

    await client.close();
    console.log("Email sent successfully via Gmail SMTP to:", to);
    return { success: true };
  } catch (error: any) {
    console.error("Gmail SMTP error:", error);
    return { success: false, error: error.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
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

      // Send rejection email via Gmail SMTP
      const emailResult = await sendEmailViaGmail(
        mcUser.email,
        "Prestige Bella Vista - MC Registration Update",
        `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 24px;">Prestige Bella Vista</h1>
              <p style="color: #f0e6d3; margin: 10px 0 0 0;">Management Committee</p>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e0d6c8; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #8B4513; margin-top: 0;">Registration Status Update</h2>
              <p>Dear <strong>${mcUser.name}</strong>,</p>
              <p>Thank you for your interest in joining the Management Committee at Prestige Bella Vista.</p>
              <p>After careful review, we regret to inform you that your registration has not been approved at this time.</p>
              ${rejection_reason ? `<div style="background: #fef3cd; border-left: 4px solid #856404; padding: 15px; margin: 20px 0;"><strong>Reason:</strong> ${rejection_reason}</div>` : ''}
              <p>If you have any questions or would like to discuss this decision, please contact the management.</p>
              <p style="margin-top: 30px;">Warm regards,<br><strong>Treasurer</strong><br>Prestige Bella Vista Management</p>
            </div>
          </div>
        `
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "MC user rejected",
          emailSent: emailResult.success,
          emailError: emailResult.error
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Approve the MC user
    const username = generateUsername(mcUser.name, mcUser.unit_no);
    
    // Check if username already exists in approved users
    const { data: existingUser } = await supabase
      .from("mc_users")
      .select("id")
      .eq("login_username", username)
      .eq("status", "approved")
      .maybeSingle();

    let finalUsername = username;
    if (existingUser) {
      finalUsername = `${username.replace('@mc-2527', '')}-${Math.floor(Math.random() * 1000)}@mc-2527`;
    }

    // Generate secure one-time token for password setup
    const passwordSetupToken = generateSecureToken();
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error: updateError } = await supabase
      .from("mc_users")
      .update({
        status: "approved",
        login_username: finalUsername,
        password_reset_token: passwordSetupToken,
        password_reset_expires_at: tokenExpiry.toISOString(),
        temp_password: null, // Clear any old temp password
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", mc_user_id);

    if (updateError) throw updateError;

    // Build the password setup URL
    const appUrl = "https://prestige-bella-vista-2025-26-expensemgt.lovable.app";
    const passwordSetupUrl = `${appUrl}/mc-set-password?token=${passwordSetupToken}`;

    // Send approval email via Gmail SMTP
    const emailResult = await sendEmailViaGmail(
      mcUser.email,
      "🎉 Welcome to Prestige Bella Vista Management Committee!",
      `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">🏠 Welcome Aboard!</h1>
            <p style="color: #f0e6d3; margin: 10px 0 0 0; font-size: 16px;">Prestige Bella Vista Management Committee</p>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e0d6c8; border-top: none;">
            <p style="font-size: 18px; color: #333;">Dear <strong>${mcUser.name}</strong>,</p>
            
            <p style="color: #555; line-height: 1.6;">Congratulations! Your registration to join the <strong>Prestige Bella Vista Management Committee</strong> has been approved.</p>
            
            <div style="background: linear-gradient(135deg, #f8f4f0 0%, #fff 100%); border: 2px solid #8B4513; border-radius: 10px; padding: 25px; margin: 25px 0;">
              <h3 style="color: #8B4513; margin-top: 0; text-align: center;">🔐 Set Up Your Password</h3>
              <p style="text-align: center; color: #555;">Click the button below to create your password and access the MC Portal:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${passwordSetupUrl}" style="display: inline-block; background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Set My Password</a>
              </div>
              <p style="color: #666; font-size: 12px; text-align: center; margin: 0;">This link expires in 7 days.</p>
            </div>
            
            <div style="background: #f8f9fa; border-left: 4px solid #8B4513; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #555;"><strong>Your Username:</strong></p>
              <p style="font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 5px; margin: 10px 0 0 0; display: inline-block;">${finalUsername}</p>
            </div>
            
            <div style="background: #f0f7f0; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <h4 style="color: #28a745; margin: 0 0 10px 0;">📋 Your Interest Groups</h4>
              <ul style="margin: 0; padding-left: 20px; color: #555;">
                ${mcUser.interest_groups.map((g: string) => `<li style="padding: 5px 0;">${g}</li>`).join('')}
              </ul>
            </div>
            
            <p style="margin-top: 30px; color: #333;">
              Warm regards,<br>
              <strong>Treasurer</strong><br>
              <span style="color: #8B4513;">Prestige Bella Vista Management</span>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #888; font-size: 12px; background: #f8f4f0; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">Unit: ${mcUser.tower_no}-${mcUser.unit_no} | Tower ${mcUser.tower_no}</p>
            <p style="margin: 10px 0 0 0;">This is an automated message from Prestige Bella Vista Society Portal</p>
          </div>
        </div>
      `
    );

    console.log("Approval completed. Email sent:", emailResult.success, "Error:", emailResult.error);

    return new Response(
      JSON.stringify({
        success: true,
        message: "MC user approved",
        username: finalUsername,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        passwordSetupUrl: passwordSetupUrl // For admin reference if email fails
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
