import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  savingsId?: string;
  trackingId?: string;
  action: 'submitted' | 'approved' | 'rejected' | 'maturity_reminder';
  type: 'master' | 'tracking' | 'maturity';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { savingsId, trackingId, action, type }: NotificationRequest = await req.json();

    console.log('Savings notification request:', { savingsId, trackingId, action, type });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'http://localhost:5173';

    if (type === 'maturity') {
      // Send maturity reminders
      const today = new Date();
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const { data: maturingSavings, error: savingsError } = await supabase
        .from('savings_master')
        .select('*')
        .eq('status', 'approved')
        .eq('current_status', 'active')
        .gte('maturity_date', today.toISOString().split('T')[0])
        .lte('maturity_date', thirtyDaysLater.toISOString().split('T')[0]);

      if (savingsError) throw savingsError;

      if (!maturingSavings || maturingSavings.length === 0) {
        return new Response(JSON.stringify({ message: 'No maturing investments' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch all treasurers
      const { data: treasurers, error: treasurerError } = await supabase
        .from('user_roles')
        .select('user_id, profiles!user_roles_user_id_fkey (full_name, email)')
        .eq('role', 'treasurer');

      if (treasurerError || !treasurers || treasurers.length === 0) {
        throw new Error('No treasurers found');
      }

      const investmentsList = maturingSavings.map(s => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${s.investment_name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${s.investment_type}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${s.bank_institution}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">₹${Number(s.current_value).toLocaleString('en-IN')}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${new Date(s.maturity_date).toLocaleDateString('en-IN')}</td>
        </tr>
      `).join('');

      for (const treasurer of treasurers) {
        const treasurerProfile = treasurer.profiles as any;

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ea580c; font-size: 24px; text-align: center;">⏰ Investment Maturity Alert</h1>
            <p>Hi ${treasurerProfile.full_name || 'Treasurer'},</p>
            <p>The following investments are maturing within the next 30 days and require your attention:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background: #fff7ed; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: #fed7aa;">
                  <th style="padding: 12px; text-align: left;">Investment</th>
                  <th style="padding: 12px; text-align: left;">Type</th>
                  <th style="padding: 12px; text-align: left;">Bank/Institution</th>
                  <th style="padding: 12px; text-align: left;">Value</th>
                  <th style="padding: 12px; text-align: left;">Maturity Date</th>
                </tr>
              </thead>
              <tbody>
                ${investmentsList}
              </tbody>
            </table>

            <p style="color: #666; font-size: 14px;">
              Please coordinate with the accountant to plan for renewal, withdrawal, or reinvestment.
            </p>

            <a href="${appUrl}/savings" style="background: #ea580c; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
              View Savings Dashboard
            </a>

            <p style="color: #8898aa; font-size: 12px; text-align: center; margin: 24px 0;">
              This is an automated notification from your Expense Management System.
            </p>
          </div>
        `;

        await resend.emails.send({
          from: 'Expense Manager <onboarding@resend.dev>',
          to: [treasurerProfile.email],
          subject: `⏰ ${maturingSavings.length} Investment(s) Maturing Soon`,
          html: emailContent,
        });
      }

      console.log(`Sent maturity reminders for ${maturingSavings.length} investments`);
      return new Response(JSON.stringify({ message: 'Maturity reminders sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle master savings notifications
    if (type === 'master' && savingsId) {
      const { data: savings, error: savingsError } = await supabase
        .from('savings_master')
        .select('*')
        .eq('id', savingsId)
        .single();

      if (savingsError || !savings) {
        throw new Error(`Savings not found: ${savingsError?.message}`);
      }

      // Get submitter profile
      const { data: submitterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', savings.created_by)
        .single();

      if (action === 'submitted') {
        // Notify treasurers
        const { data: treasurers, error: treasurerError } = await supabase
          .from('user_roles')
          .select('user_id, profiles!user_roles_user_id_fkey (full_name, email)')
          .eq('role', 'treasurer');

        if (treasurerError || !treasurers || treasurers.length === 0) {
          throw new Error('No treasurers found');
        }

        for (const treasurer of treasurers) {
          const treasurerProfile = treasurer.profiles as any;

          const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; font-size: 24px; text-align: center;">New Investment Submitted</h1>
              <p>Hi ${treasurerProfile.full_name || 'Treasurer'},</p>
              <p>A new investment has been submitted and requires your approval.</p>
              
              <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Investment Name:</p>
                <p style="color: #111827; font-size: 16px;">${savings.investment_name}</p>
                
                <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Type:</p>
                <p style="color: #111827; font-size: 16px;">${savings.investment_type}</p>
                
                <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Bank/Institution:</p>
                <p style="color: #111827; font-size: 16px;">${savings.bank_institution}</p>
                
                <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Principal Amount:</p>
                <p style="color: #2563eb; font-size: 20px; font-weight: bold;">₹${Number(savings.principal_amount).toLocaleString('en-IN')}</p>
                
                ${savings.interest_rate ? `<p style="color: #6b7280; font-size: 12px;">Interest Rate: ${savings.interest_rate}%</p>` : ''}
                ${savings.maturity_date ? `<p style="color: #6b7280; font-size: 12px;">Maturity Date: ${new Date(savings.maturity_date).toLocaleDateString('en-IN')}</p>` : ''}
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                
                <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Submitted By:</p>
                <p style="color: #111827; font-size: 16px;">${submitterProfile?.full_name || 'Accountant'}</p>
              </div>

              <a href="${appUrl}/approvals?tab=savings" style="background: #2563eb; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
                Review & Approve
              </a>
            </div>
          `;

          await resend.emails.send({
            from: 'Expense Manager <onboarding@resend.dev>',
            to: [treasurerProfile.email],
            subject: `New Investment: ₹${Number(savings.principal_amount).toLocaleString('en-IN')} - ${savings.investment_name}`,
            html: emailContent,
          });
        }

        console.log('Sent submission notifications to treasurers');
      } else if (action === 'approved' || action === 'rejected') {
        // Notify submitter
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: ${action === 'approved' ? '#16a34a' : '#dc2626'}; font-size: 24px; text-align: center;">
              ${action === 'approved' ? '✓ Investment Approved' : '✕ Investment Rejected'}
            </h1>
            <p>Hi ${submitterProfile?.full_name || 'User'},</p>
            <p>Your investment submission has been ${action}.</p>
            
            <div style="background: ${action === 'approved' ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${action === 'approved' ? '#bbf7d0' : '#fecaca'}; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Investment:</p>
              <p style="color: #111827; font-size: 16px;">${savings.investment_name}</p>
              
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Amount:</p>
              <p style="color: ${action === 'approved' ? '#16a34a' : '#dc2626'}; font-size: 20px; font-weight: bold;">₹${Number(savings.principal_amount).toLocaleString('en-IN')}</p>
            </div>

            <a href="${appUrl}/savings" style="background: ${action === 'approved' ? '#16a34a' : '#dc2626'}; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
              View Savings
            </a>
          </div>
        `;

        if (submitterProfile?.email) {
          await resend.emails.send({
            from: 'Expense Manager <onboarding@resend.dev>',
            to: [submitterProfile.email],
            subject: `${action === 'approved' ? '✓' : '✕'} Investment ${action}: ${savings.investment_name}`,
            html: emailContent,
          });
        }

        console.log(`Sent ${action} notification to submitter`);
      }
    }

    // Handle tracking notifications
    if (type === 'tracking' && trackingId) {
      const { data: tracking, error: trackingError } = await supabase
        .from('savings_tracking')
        .select('*, savings_master(*)')
        .eq('id', trackingId)
        .single();

      if (trackingError || !tracking) {
        throw new Error(`Tracking not found: ${trackingError?.message}`);
      }

      // Get submitter profile
      const { data: submitterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', tracking.submitted_by)
        .single();

      if (action === 'submitted') {
        // Notify treasurers
        const { data: treasurers } = await supabase
          .from('user_roles')
          .select('user_id, profiles!user_roles_user_id_fkey (full_name, email)')
          .eq('role', 'treasurer');

        for (const treasurer of treasurers || []) {
          const treasurerProfile = treasurer.profiles as any;

          await resend.emails.send({
            from: 'Expense Manager <onboarding@resend.dev>',
            to: [treasurerProfile.email],
            subject: `Savings Tracking: ${tracking.action_type} - ${tracking.savings_master?.investment_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333; font-size: 24px; text-align: center;">Savings Tracking Update</h1>
                <p>A new tracking entry requires your approval.</p>
                <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
                  <p><strong>Investment:</strong> ${tracking.savings_master?.investment_name}</p>
                  <p><strong>Action:</strong> ${tracking.action_type}</p>
                  <p><strong>Amount:</strong> ₹${Number(tracking.amount || 0).toLocaleString('en-IN')}</p>
                  <p><strong>Value After:</strong> ₹${Number(tracking.value_after_action).toLocaleString('en-IN')}</p>
                </div>
                <a href="${appUrl}/approvals?tab=savings" style="background: #2563eb; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
                  Review & Approve
                </a>
              </div>
            `,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-savings-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
