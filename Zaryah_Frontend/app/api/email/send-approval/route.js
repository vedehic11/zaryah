import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { sellerEmail, sellerName, businessName, username } = await request.json()

    if (!sellerEmail || !sellerName || !businessName || !username) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured. Email would be sent to:', sellerEmail)
      console.log('Email content:')
      console.log('---------------------')
      console.log(`To: ${sellerEmail}`)
      console.log(`Subject: Congratulations! Your Zaryah seller account is approved`)
      console.log('')
      console.log(`Dear ${sellerName},`)
      console.log('')
      console.log(`Great news! Your seller account for "${businessName}" has been approved.`)
      console.log('')
      console.log(`You can now access your seller dashboard and start listing your products:`)
      console.log(`https://zaryah.com/${username}`)
      console.log('')
      console.log(`What you can do now:`)
      console.log(`- Add your products to your store`)
      console.log(`- Customize your shop profile`)
      console.log(`- Start receiving orders`)
      console.log('')
      console.log(`If you have any questions, feel free to contact our support team.`)
      console.log('')
      console.log(`Best regards,`)
      console.log(`The Zaryah Team`)
      console.log('---------------------')

      return Response.json({
        success: true,
        message: 'Email service not configured. Email content logged to console.',
        emailLogged: true
      })
    }

    // Send email using Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'Zaryah <onboarding@zaryah.com>', // Replace with your verified domain
        to: [sellerEmail],
        subject: 'Congratulations! Your Zaryah seller account is approved',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                color: white;
                padding: 30px;
                border-radius: 10px 10px 0 0;
                text-align: center;
              }
              .content {
                background: #fff;
                padding: 30px;
                border: 1px solid #e0e0e0;
                border-top: none;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
              }
              .features {
                background: #f9f9f9;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .feature-item {
                padding: 10px 0;
                border-bottom: 1px solid #e0e0e0;
              }
              .feature-item:last-child {
                border-bottom: none;
              }
              .footer {
                background: #f5f5f5;
                padding: 20px;
                border-radius: 0 0 10px 10px;
                text-align: center;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Your seller account is now active</p>
            </div>
            
            <div class="content">
              <p>Dear <strong>${sellerName}</strong>,</p>
              
              <p>Great news! Your seller account for "<strong>${businessName}</strong>" has been approved by our admin team.</p>
              
              <p>You can now access your seller dashboard and start listing your products:</p>
              
              <div style="text-align: center;">
                <a href="https://zaryah.com/${username}" class="button">Go to Your Dashboard</a>
              </div>
              
              <div class="features">
                <h3 style="margin-top: 0;">What you can do now:</h3>
                <div class="feature-item">✅ Add your products to your store</div>
                <div class="feature-item">✅ Customize your shop profile</div>
                <div class="feature-item">✅ Upload product photos and descriptions</div>
                <div class="feature-item">✅ Start receiving orders from customers</div>
                <div class="feature-item">✅ Track your sales and analytics</div>
              </div>
              
              <p>Your custom shop URL is: <strong>https://zaryah.com/${username}</strong></p>
              
              <p>If you have any questions or need assistance getting started, feel free to contact our support team.</p>
              
              <p>We're excited to have you as part of the Zaryah community!</p>
              
              <p>Best regards,<br><strong>The Zaryah Team</strong></p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from Zaryah. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Zaryah. All rights reserved.</p>
            </div>
          </body>
          </html>
        `
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', data)
      return Response.json(
        { error: 'Failed to send email', details: data },
        { status: response.status }
      )
    }

    console.log('✅ Approval email sent successfully to:', sellerEmail)
    return Response.json({
      success: true,
      message: 'Email sent successfully',
      emailId: data.id
    })

  } catch (error) {
    console.error('Error sending approval email:', error)
    return Response.json(
      { error: 'Failed to send email', message: error.message },
      { status: 500 }
    )
  }
}
