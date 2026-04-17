import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const TO = process.env.CONTACT_EMAIL || 'uzairlatif293@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, message } = await req.json()

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 })
    }

    await resend.emails.send({
      from: 'InfoSenior.care <onboarding@resend.dev>',
      to: TO,
      replyTo: email,
      subject: `Contact Form: ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6f9;padding:40px 20px;">
          <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">InfoSenior<span style="color:#90caf9;">.care</span></h1>
              <p style="margin:6px 0 0;color:#bbdefb;font-size:12px;letter-spacing:1px;text-transform:uppercase;">New Contact Form Submission</p>
            </div>
            <div style="padding:32px 40px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px;width:120px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a2e;font-weight:600;">${name}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a73e8;">${email}</td></tr>
                ${phone ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a2e;">${phone}</td></tr>` : ''}
                <tr><td style="padding:10px 0;color:#888;font-size:12px;vertical-align:top;padding-top:16px;">Message</td><td style="padding:10px 0;font-size:14px;color:#1a1a2e;line-height:1.6;padding-top:16px;">${message.replace(/\n/g, '<br/>')}</td></tr>
              </table>
            </div>
            <div style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;color:#999;font-size:12px;">Sent from InfoSenior.care contact form</p>
            </div>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
