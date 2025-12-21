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
      const rejectionEmail = await resend.emails.send({
        from: "Prestige Bella Vista <pbv.mc.2527@gmail.com>",
        reply_to: "pbv.mc.2527@gmail.com",
        to: [mcUser.email],
        subject: "Prestige Bella Vista - MC Registration Update",
        html: `
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
              <p>If you have any questions or would like to discuss this decision, please reply to this email.</p>
              <p style="margin-top: 30px;">Warm regards,<br><strong>Treasurer</strong><br>Prestige Bella Vista Management</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
              <p>This is an automated message from Prestige Bella Vista Society Portal</p>
            </div>
          </div>
        `,
      });

      console.log("Rejection email send result:", rejectionEmail);
      if ((rejectionEmail as any)?.error) {
        console.error("Resend rejection email error:", (rejectionEmail as any).error);
        throw new Error((rejectionEmail as any).error?.message || "Failed to send rejection email");
      }

      return new Response(
        JSON.stringify({ success: true, message: "MC user rejected" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Approve the MC user
    const tempPassword = generateTempPassword();
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
      // Only append suffix if there's a collision with an ALREADY APPROVED user
      finalUsername = `${username.replace('@mc-2527', '')}-${Math.floor(Math.random() * 1000)}@mc-2527`;
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
      from: "Prestige Bella Vista <pbv.mc.2527@gmail.com>",
      reply_to: "pbv.mc.2527@gmail.com",
      to: [mcUser.email],
      subject: "🎉 Welcome to Prestige Bella Vista Management Committee!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 28px;">🏠 Welcome Aboard!</h1>
            <p style="color: #f0e6d3; margin: 10px 0 0 0; font-size: 16px;">Prestige Bella Vista Management Committee</p>
          </div>
          
          <div style="background: #fff; padding: 30px; border: 1px solid #e0d6c8; border-top: none;">
            <p style="font-size: 18px; color: #333;">Dear <strong>${mcUser.name}</strong>,</p>
            
            <p style="color: #555; line-height: 1.6;">Congratulations! Your registration to join the <strong>Prestige Bella Vista Management Committee</strong> has been approved.</p>
            
            <div style="background: linear-gradient(135deg, #f8f4f0 0%, #fff 100%); border: 2px solid #8B4513; border-radius: 10px; padding: 25px; margin: 25px 0;">
              <h3 style="color: #8B4513; margin-top: 0; text-align: center; border-bottom: 2px solid #e0d6c8; padding-bottom: 10px;">🔐 Your Login Credentials</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #666; width: 40%;">Username:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #333; font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 5px;">${finalUsername}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #666;">Temporary Password:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #333; font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 5px;">${tempPassword}</td>
                </tr>
              </table>
              <p style="color: #856404; background: #fff3cd; padding: 10px; border-radius: 5px; margin: 15px 0 0 0; font-size: 13px; text-align: center;">
                ⚠️ Please change your password after your first login for security.
              </p>
            </div>
            
            <div style="background: #f0f7f0; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <h4 style="color: #28a745; margin: 0 0 10px 0;">📋 Your Interest Groups</h4>
              <ul style="margin: 0; padding-left: 20px; color: #555;">
                ${mcUser.interest_groups.map((g: string) => `<li style="padding: 5px 0;">${g}</li>`).join('')}
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #555; margin-bottom: 15px;">Access the MC Portal:</p>
              <a href="https://prestige-bella-vista-2025-26-expensemgt.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Login to MC Portal</a>
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
      `,
    });

    console.log("Approval email send result:", emailResponse);
    if ((emailResponse as any)?.error) {
      console.error("Resend approval email error:", (emailResponse as any).error);
      throw new Error((emailResponse as any).error?.message || "Failed to send approval email");
    }
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