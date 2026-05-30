import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Primetek Global Solutions',
  description: 'Privacy Policy for Primetek Global Solutions LLC. Learn how we collect, use, and protect your information.',
  alternates: {
    canonical: 'https://www.primetekglobalsolutions.com/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-[768px] mx-auto px-4">
        {/* Title */}
        <h1 className="text-3xl md:text-5xl font-semibold text-ink tracking-[-1.5px] leading-tight mb-4">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted mb-8">Last Updated: 2024</p>

        {/* Content */}
        <div className="space-y-6 text-sm text-body-text leading-relaxed">
          <p>
            At Primetek Global Solutions LLC, we value your privacy and are committed to protecting your personal information. This Privacy Policy details how we handle the data you provide when interacting with our public website.
          </p>

          <h2 className="text-xl font-semibold text-ink pt-4 border-t border-hairline">
            1. Information We Collect
          </h2>
          <p>
            We collect information that you voluntarily submit through our contact and inquiry forms. This includes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Full Name</li>
            <li>Email Address</li>
            <li>Phone Number</li>
            <li>Company Name</li>
            <li>Staffing requirements and any other message content you provide</li>
          </ul>

          <h2 className="text-xl font-semibold text-ink pt-4 border-t border-hairline">
            2. How We Use Your Information
          </h2>
          <p>
            We use the collected information exclusively to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Respond to your staffing requests and inquiries</li>
            <li>Provide candidate shortlists and recruitment proposals</li>
            <li>Communicate with you regarding our placement services</li>
          </ul>
          <p>
            We do not use your information for unrelated marketing campaigns or automated profiling.
          </p>

          <h2 className="text-xl font-semibold text-ink pt-4 border-t border-hairline">
            3. Sharing and Selling Information
          </h2>
          <p>
            <strong>We do not sell, rent, or trade your personal information to third parties.</strong> Your data is accessed only by authorized Primetek Global Solutions personnel for the purpose of fulfilling your recruitment and placement needs.
          </p>

          <h2 className="text-xl font-semibold text-ink pt-4 border-t border-hairline">
            4. Security
          </h2>
          <p>
            We implement industry-standard administrative and electronic security measures to safeguard the information we collect online. However, please be aware that no transmission over the internet can be guaranteed as 100% secure.
          </p>

          <h2 className="text-xl font-semibold text-ink pt-4 border-t border-hairline">
            5. Governing Law
          </h2>
          <p>
            This website and our operations are governed by the laws of the State of Alabama, USA.
          </p>

          <h2 className="text-xl font-semibold text-ink pt-4 border-t border-hairline">
            6. Contact Us
          </h2>
          <p>
            If you have questions or concerns about this policy, please reach out to us at:
          </p>
          <p className="font-semibold text-ink">
            Primetek Global Solutions LLC<br />
            Email: <a href="mailto:hr@primetekglobalsolutions.com" className="text-teal-primary hover:underline">hr@primetekglobalsolutions.com</a><br />
            Address: 1680, Unit 2G, 14th Ave S, Birmingham, AL 35205
          </p>
        </div>
      </div>
    </section>
  );
}
