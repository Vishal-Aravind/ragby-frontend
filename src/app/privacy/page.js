export default function PrivacyPolicy() {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 prose">
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
  
        <h2>Information We Collect</h2>
        <p>Zavo collects messages sent through connected channels (WhatsApp, Telegram, Slack) solely to provide automated responses using your configured data sources.</p>
  
        <h2>How We Use Your Information</h2>
        <p>Messages are processed to generate AI responses and are stored temporarily to maintain conversation context. We do not sell or share your data with third parties.</p>
  
        <h2>Data Retention</h2>
        <p>Conversation data is retained for the duration of your account. You can delete your data at any time by contacting us.</p>
  
        <h2>Contact</h2>
        <p>For privacy questions contact: your@email.com</p>
      </div>
    );
  }