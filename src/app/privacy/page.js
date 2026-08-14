export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: May 21, 2026</p>

      <div className="prose prose-sm max-w-none space-y-8 text-gray-700">

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
          <p>
            Askzavo ("we", "our", or "us") operates an AI-powered business automation platform accessible at askzavo.com. This Privacy Policy explains how we collect, use, store, and protect information when you use our services, including our WhatsApp Business API integration, website chat widget, Telegram bot, and Slack integration.
          </p>
          <p className="mt-2">
            By using Askzavo, you agree to the collection and use of information in accordance with this policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
          <h3 className="font-medium text-gray-800 mb-1">2.1 Account Information</h3>
          <p>When you create an Askzavo account, we collect your name, email address, and password.</p>

          <h3 className="font-medium text-gray-800 mt-3 mb-1">2.2 Business Data</h3>
          <p>We collect documents, spreadsheets, website content, and database information that you upload or connect to your Askzavo projects. This data is used solely to power AI responses for your business.</p>

          <h3 className="font-medium text-gray-800 mt-3 mb-1">2.3 WhatsApp Message Data</h3>
          <p>When you connect a WhatsApp Business number to Askzavo, we process incoming and outgoing WhatsApp messages to provide automated AI responses. Specifically:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>We receive message content sent by your customers to your WhatsApp Business number</li>
            <li>We store message history to maintain conversation context</li>
            <li>We use message content solely to generate AI responses using your configured data sources</li>
            <li>We do not use WhatsApp message content for advertising or marketing purposes</li>
            <li>We do not sell WhatsApp message data to third parties</li>
          </ul>

          <h3 className="font-medium text-gray-800 mt-3 mb-1">2.4 Usage Data</h3>
          <p>We collect information about how you use our platform, including the number of messages processed, features used, and account activity.</p>

          <h3 className="font-medium text-gray-800 mt-3 mb-1">2.5 Payment Information</h3>
          <p>Payment processing is handled by Razorpay. We do not store your credit card details. Razorpay's privacy policy applies to payment data.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>To provide and operate the Askzavo platform</li>
            <li>To generate AI responses to messages sent to your connected channels</li>
            <li>To maintain conversation history and context for better AI responses</li>
            <li>To process payments and manage subscriptions</li>
            <li>To send service-related communications (account alerts, usage notifications)</li>
            <li>To improve and develop our services</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. WhatsApp Business API Data Handling</h2>
          <p>Askzavo integrates with the WhatsApp Business API provided by Meta Platforms, Inc. In connection with this integration:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>We act as a data processor on behalf of businesses (our customers) who connect their WhatsApp Business accounts</li>
            <li>Message data is processed in real-time to generate automated responses</li>
            <li>We store conversation history in our secure database (Supabase) to provide context for ongoing conversations</li>
            <li>WhatsApp message content is never used for advertising, sold to third parties, or shared outside the scope of providing our service</li>
            <li>End users (your customers) can request deletion of their conversation data by contacting the business they are chatting with</li>
            <li>We comply with WhatsApp's Business Policy and Commerce Policy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Storage and Security</h2>
          <p>
            Your data is stored on secure cloud infrastructure including Supabase (database), Qdrant (vector database), and Vercel (frontend). We implement industry-standard security measures including encryption in transit (HTTPS/TLS) and encryption at rest.
          </p>
          <p className="mt-2">
            Access to your data is restricted to authorized personnel only and is protected by role-based access controls.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Conversation history is retained to provide context for ongoing conversations. You may request deletion of your data at any time by contacting us at the email below.
          </p>
          <p className="mt-2">
            Upon account deletion, we will delete your personal data, project data, and conversation history within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li><strong>OpenAI</strong> — message content is sent to OpenAI's API to generate AI responses</li>
            <li><strong>Supabase</strong> — secure database storage</li>
            <li><strong>Razorpay</strong> — payment processing</li>
            <li><strong>Meta/WhatsApp</strong> — to send and receive WhatsApp messages via the Business API</li>
            <li><strong>Legal authorities</strong> — when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p className="mt-2">To exercise these rights, contact us at khavinprakash03@gmail.com</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Cookies</h2>
          <p>
            We use essential cookies to maintain your login session. We do not use tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Children's Privacy</h2>
          <p>
            Askzavo is not intended for use by children under 13. We do not knowingly collect personal data from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by posting a notice on our platform. Continued use of Askzavo after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Contact Us</h2>
          <p>For privacy questions, data requests, or concerns:</p>
          <ul className="list-none mt-2 space-y-1">
            <li><strong>Email:</strong> khavinprakash03@gmail.com</li>
            <li><strong>Website:</strong> https://ragby-frontend.vercel.app</li>
            <li><strong>Business:</strong> Askzavo</li>
          </ul>
        </section>

      </div>
    </div>
  );
}