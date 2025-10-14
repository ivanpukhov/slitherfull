import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { LegalLayout, LegalSection } from '../components/legal/LegalLayout'

export function TermsOfService() {
  useEffect(() => {
    document.title = 'SnakeFans Terms of Service'
  }, [])

  return (
    <LegalLayout title="SnakeFans Terms of Service" effectiveDate="5 May 2024">
      <LegalSection title="1. Acceptance of Terms">
        <p>
          These Terms of Service (“Terms”) govern your access to and use of the SnakeFans website, game, and
          related services (collectively, the “Services”). By creating an account, accessing, or using the Services,
          you agree to be bound by these Terms and our{' '}
          <Link to="/privacy-policy">Privacy Policy</Link>. If you do not agree, do not use the Services.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 13 years old, or the minimum age of digital consent in your jurisdiction, to use the
          Services. By using the Services, you represent that you meet this requirement and that you have the legal
          capacity to enter into these Terms.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and Security">
        <ol className="legal-page__list">
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You agree to notify us immediately of any unauthorised use of your account.</li>
          <li>We may suspend or terminate accounts that violate these Terms or pose security risks.</li>
        </ol>
      </LegalSection>

      <LegalSection title="4. Virtual Currency and Transactions">
        <p>
          SnakeFans includes virtual currency (“coins”) used for gameplay. Coins have no real-world monetary value
          outside the Services. You agree that purchases, winnings, or transfers of coins are final and non-refundable
          except where required by law. We may adjust coin balances to correct errors or address suspected fraud.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable Use">
        <p>You agree not to:</p>
        <ol className="legal-page__list">
          <li>Use the Services for illegal or unauthorised purposes.</li>
          <li>Interfere with or disrupt the integrity or performance of the Services.</li>
          <li>Attempt to gain unauthorised access to other accounts, systems, or networks.</li>
          <li>Use automated tools to scrape, harvest, or exploit the Services.</li>
        </ol>
      </LegalSection>

      <LegalSection title="6. Intellectual Property">
        <p>
          SnakeFans and its licensors own all rights, title, and interest in the Services, including graphics, gameplay
          mechanics, and trademarks. You may not copy, modify, distribute, or create derivative works without prior
          written consent.
        </p>
      </LegalSection>

      <LegalSection title="7. Community Features">
        <p>
          The Services may include features such as leaderboards, chat, or friend lists. You are responsible for your
          interactions with other users. We may moderate or remove content that violates these Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-Party Services">
        <p>
          The Services may link to third-party websites or integrate third-party tools. We are not responsible for
          third-party content or services. Your use of third-party services is subject to the respective terms and
          policies of those providers.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of Warranties">
        <p>
          THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED,
          INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
          NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SNAKEFANS AND ITS AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS OR REVENUE, WHETHER INCURRED
          DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          We may suspend or terminate your access to the Services at any time if we believe you have violated these
          Terms, engaged in fraudulent activity, or pose a risk to other users. You may stop using the Services at any
          time. Sections of these Terms that by their nature should survive termination will remain in effect.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to the Services">
        <p>
          We may modify or discontinue the Services, or any part of them, at our discretion. When possible, we will
          provide prior notice of significant changes. Continued use of the Services after changes take effect
          constitutes acceptance of the updated Services and Terms.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing Law">
        <p>
          These Terms are governed by the laws of Estonia, without regard to its conflict of law principles. You agree to
          submit to the exclusive jurisdiction of the courts located in Tallinn, Estonia, for any disputes arising out of
          or relating to the Services or these Terms.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to These Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the “Effective date” at the top of this
          page and, if required by law, provide additional notice. Your continued use of the Services after the updated
          Terms become effective signifies your acceptance.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact Us">
        <p>
          If you have questions about these Terms, please contact us at{' '}
          <a href="mailto:legal@snakefans.com">legal@snakefans.com</a> or by mail at SnakeFans, 123 Game Street, Tallinn,
          Estonia.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}

export default TermsOfService
