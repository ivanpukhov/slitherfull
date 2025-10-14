import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { LegalLayout, LegalSection } from '../components/legal/LegalLayout'

export function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'SnakeFans Privacy Policy'
  }, [])

  return (
    <LegalLayout title="SnakeFans Privacy Policy" effectiveDate="5 May 2024">
      <LegalSection title="Overview">
        <p>
          SnakeFans (“we”, “us”, “our”) respects your privacy and is committed to protecting your personal information.
          This Privacy Policy explains how we collect, use, disclose, and safeguard information when you access our
          website, play the SnakeFans game, or interact with related services (collectively, the “Services”).
        </p>
      </LegalSection>

      <LegalSection title="Information We Collect">
        <p>We collect the following categories of information:</p>
        <ul className="legal-page__list">
          <li>
            <strong>Account information</strong>, such as your email address, nickname, and password hash.
          </li>
          <li>
            <strong>Gameplay data</strong>, including session identifiers, match history, leaderboard standings, and
            wallet balances.
          </li>
          <li>
            <strong>Device and log information</strong>, such as IP address, browser type, operating system, and usage
            statistics collected through analytics tooling.
          </li>
          <li>
            <strong>Support communications</strong>, including messages you send to our support channels.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How We Use Information">
        <p>We use the information we collect to:</p>
        <ul className="legal-page__list">
          <li>Provide, operate, and maintain the Services.</li>
          <li>Authenticate users, prevent fraud, and ensure platform integrity.</li>
          <li>Process in-game transactions and display accurate leaderboard data.</li>
          <li>Respond to requests, questions, and support inquiries.</li>
          <li>Improve our gameplay experience, including debugging and analytics.</li>
          <li>Comply with legal obligations and enforce our <Link to="/terms-of-service">Terms of Service</Link>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How We Share Information">
        <p>
          We do not sell personal information. We only share data with service providers and partners that help us
          deliver the Services, such as hosting providers, analytics platforms, and payment or wallet infrastructure.
          These parties are bound by contractual obligations to protect your data and to use it only for the purposes we
          specify. We may also disclose information if required by law, regulation, or legal process.
        </p>
      </LegalSection>

      <LegalSection title="International Data Transfers">
        <p>
          SnakeFans operates globally. Your information may be transferred to, stored in, or processed in countries other
          than the one in which it was collected. We implement safeguards to protect your data in accordance with
          applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Data Retention">
        <p>
          We retain personal information for as long as necessary to provide the Services, fulfil the purposes outlined
          in this policy, and comply with legal obligations. When information is no longer required, we will delete or
          anonymise it.
        </p>
      </LegalSection>

      <LegalSection title="Your Rights and Choices">
        <p>Depending on your location, you may have rights to:</p>
        <ul className="legal-page__list">
          <li>Access, correct, or delete personal information we hold about you.</li>
          <li>Object to or restrict our processing of your personal information.</li>
          <li>Request data portability.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p>
          You can exercise these rights by contacting us at{' '}
          <a href="mailto:privacy@snakefans.com">privacy@snakefans.com</a>. We may request verification of your identity
          before fulfilling certain requests.
        </p>
      </LegalSection>

      <LegalSection title="Children’s Privacy">
        <p>
          The Services are not directed to children under the age of 13 (or the equivalent minimum age in your
          jurisdiction). We do not knowingly collect personal information from children. If we learn that we have
          collected personal information from a child, we will delete it promptly.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use administrative, technical, and physical safeguards designed to protect personal information. However, no
          method of transmission or storage is completely secure, so we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="Third-Party Links and Services">
        <p>
          Our Services may contain links to third-party websites or services. We are not responsible for the privacy
          practices of those third parties. We encourage you to review the privacy policies of any third-party services
          you access.
        </p>
      </LegalSection>

      <LegalSection title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the “Effective date” at the top
          of this page and provide additional notice if required by law. Your continued use of the Services after an
          update constitutes acceptance of the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you have questions or concerns about this Privacy Policy or our data practices, please contact us at{' '}
          <a href="mailto:privacy@snakefans.com">privacy@snakefans.com</a> or by mail at SnakeFans, 123 Game Street,
          Tallinn, Estonia.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}

export default PrivacyPolicy
