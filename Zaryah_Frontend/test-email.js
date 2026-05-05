const testData = {
  sellerEmail: "vedehichoudhary11106@gmail.com",
  sellerName: "Vedic Choudhary",
  businessName: "Vedic Store",
  username: "vedic-store",
  profileLink: "https://zaryah.com/vedic-store",
  dashboardLink: "https://zaryah.com/seller/dashboard"
};

fetch('http://localhost:3000/api/email/send-approval', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testData)
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Email sent successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\nEmail details:');
    console.log(`To: ${testData.sellerEmail}`);
    console.log(`Seller: ${testData.sellerName}`);
    console.log(`Business: ${testData.businessName}`);
    console.log(`Username: ${testData.username}`);
    console.log(`Profile: ${testData.profileLink}`);
    console.log(`Dashboard: ${testData.dashboardLink}`);
  })
  .catch(err => {
    console.error('❌ Error sending email:');
    console.error(err.message);
    console.log('\n⚠️ Make sure:');
    console.log('1. Dev server is running on http://localhost:3000');
    console.log('2. You have RESEND_API_KEY in .env.local (or email will log to console)');
  });
