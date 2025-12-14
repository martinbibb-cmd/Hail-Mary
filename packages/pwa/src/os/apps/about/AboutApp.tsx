/**
 * About App - Information about Atlas by PHM
 * 
 * Displays comprehensive information about Atlas by PHM,
 * including mission, principles, and technology details.
 */

import React from 'react';
import './AboutApp.css';

export const AboutApp: React.FC = () => {
  return (
    <div className="about-app">
      <div className="about-header">
        <h1>Atlas by PHM</h1>
        <p className="about-tagline">Helping homes carry less weight</p>
      </div>

      <div className="about-content">
        <section className="about-section">
          <p className="about-intro">
            Atlas by PHM is an evidence-led platform designed to help people understand their homes as energy systems — and make better decisions about how to improve them.
          </p>
          <p>
            Homes are complex. Insulation, heating, hot water, ventilation, solar generation, storage, and controls all interact. Changes made in isolation often lead to wasted cost, underperformance, or disappointment. Atlas exists to bring clarity to that complexity.
          </p>
          <p>
            By combining clear measurement, visual explanation, and practical planning tools, Atlas supports advisors and homeowners in choosing solutions that genuinely improve comfort, efficiency, and long-term resilience.
          </p>
        </section>

        <section className="about-section">
          <h2>Our Mission</h2>
          <p>
            Atlas exists to help people make better decisions about their homes.
          </p>
          <p>
            By combining evidence, clear explanation, and practical tools, Atlas enables advisors and homeowners to understand how a home uses energy, where improvements genuinely matter, and how changes can be staged responsibly over time.
          </p>
          <p>
            Atlas provides education and solutions that improve efficiency and comfort in an evidence-based way — creating a trusted roadmap toward a more sustainable future, without bias, pressure, or unnecessary complexity.
          </p>
        </section>

        <section className="about-section">
          <h2>Our Principles</h2>
          
          <div className="principle">
            <h3>Evidence before opinion</h3>
            <p>
              Atlas is guided by measured data, clear assumptions, and transparent reasoning.
              Recommendations exist to serve the customer — not a product, a quota, or a trend.
            </p>
          </div>

          <div className="principle">
            <h3>Under-promise. Over-deliver.</h3>
            <p>
              Atlas favours realistic outcomes and honest uncertainty.
              If something cannot be supported by evidence, it is treated as a risk — not a claim.
            </p>
          </div>

          <div className="principle">
            <h3>Tools that enable better decisions</h3>
            <p>
              Atlas provides high-quality information, visualisation, and planning tools so advisors and customers can arrive at the best solution together — with confidence and clarity.
            </p>
          </div>

          <div className="principle">
            <h3>Design with the future in mind</h3>
            <p>
              Every recommendation should make future improvements easier, not harder.
              Atlas supports phased upgrades, long-term thinking, and adaptable homes.
            </p>
          </div>
        </section>

        <section className="about-section">
          <h2>Technology-agnostic by design</h2>
          <p>
            Atlas is not tied to any single manufacturer or technology.
          </p>
          <p>
            It supports a wide range of energy-saving and renewable measures, including:
          </p>
          <ul className="tech-list">
            <li>insulation and fabric improvements</li>
            <li>heating and hot water systems</li>
            <li>heat pumps</li>
            <li>solar PV</li>
            <li>battery storage</li>
            <li>controls and demand reduction strategies</li>
          </ul>
          <p>
            Recommendations are driven by evidence and context — not brand alignment.
          </p>
        </section>

        <section className="about-section">
          <h2>Who Atlas is for</h2>
          <p>Atlas is built for:</p>
          <ul className="audience-list">
            <li>energy and heating advisors</li>
            <li>retrofit and sustainability professionals</li>
            <li>surveyors and consultants</li>
            <li>homeowners who want clear, honest guidance</li>
          </ul>
          <p>
            It is designed to support professional judgement — not replace it.
          </p>
        </section>

        <section className="about-section">
          <h2>Why Atlas</h2>
          <p>
            The transition to more efficient, lower-impact homes will only succeed if decisions are:
          </p>
          <ul className="values-list">
            <li>informed</li>
            <li>proportionate</li>
            <li>honest about uncertainty</li>
            <li>respectful of people's homes and finances</li>
          </ul>
          <p className="about-closing">
            Atlas exists to support that transition — quietly, carefully, and responsibly.
          </p>
        </section>

        <div className="about-footer">
          <p className="about-motto">
            <strong>Atlas by PHM</strong>
          </p>
          <p className="about-motto-tagline">
            Engineering clarity for a lighter future.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutApp;
