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
        <p className="about-tagline">Supporting homeowners through complex decisions</p>
      </div>

      <div className="about-content">
        <section className="about-section mission-statement">
          <h2>Mission Statement</h2>
          <p className="mission-intro">
            Atlas by PHM exists to make homes more comfortable, efficient, and sustainable — through evidence-based advice, honest planning, and practical tools that put people first.
          </p>
          <p>
            We believe good decisions come from clear information, not pressure selling.
            Atlas provides the knowledge, structure, and long-term thinking needed to improve homes properly — whether that's today's upgrade or a roadmap for the next decade.
          </p>
          <p>
            We are technology-agnostic, customer-led, and grounded in real-world experience.
            If something isn't right, we say so.
            If there's uncertainty, we under-promise and over-deliver.
            And if there's a better solution tomorrow, we plan for it today.
          </p>
        </section>

        <section className="about-section">
          <h2>About Atlas by PHM</h2>
          <p>
            Atlas by PHM is an independent platform for improving residential energy efficiency — from insulation and heating to renewables, storage, and beyond.
          </p>
          <p className="about-problem">
            It was created to solve a simple problem:
            homeowners and professionals alike are often forced to make complex, high-impact decisions with incomplete, biased, or oversimplified information.
          </p>
          <p>
            <strong>Atlas takes a different approach.</strong>
          </p>
        </section>

        <section className="about-section">
          <h2>What Atlas Does</h2>
          <p>Atlas provides:</p>
          <ul className="what-list">
            <li>Clear, evidence-based guidance on energy-saving and renewable technologies</li>
            <li>Practical tools to assess homes properly, not generically</li>
            <li>Honest recommendations that prioritise comfort, efficiency, and longevity</li>
            <li>A future-ready roadmap, not just a single product or install</li>
          </ul>
          
          <p className="subsection-label">This can include:</p>
          <ul className="tech-list">
            <li>Loft and fabric improvements</li>
            <li>Heating system upgrades and controls</li>
            <li>Hot water solutions</li>
            <li>Solar PV, batteries, and emerging technologies</li>
            <li>Whole-home efficiency planning</li>
          </ul>
          
          <p className="atlas-independence">
            Atlas is not tied to any single manufacturer, installer, or technology.
            Solutions are chosen because they make sense — not because they're fashionable or profitable.
          </p>
        </section>

        <section className="about-section">
          <h2>Our Principles</h2>
          <p className="principles-intro">Atlas is built on four core principles:</p>
          
          <div className="principle">
            <h3>1. Evidence before opinion</h3>
            <p>
              Decisions should be driven by data, physics, and real-world outcomes — not trends or sales targets.
            </p>
          </div>

          <div className="principle">
            <h3>2. Customer-led, always</h3>
            <p>
              Every home, household, and budget is different. Atlas adapts to people — not the other way around.
            </p>
          </div>

          <div className="principle">
            <h3>3. Under-promise, over-deliver</h3>
            <p>
              We don't oversell savings or certainty. We plan conservatively and aim to exceed expectations.
            </p>
          </div>

          <div className="principle">
            <h3>4. Plan for the future</h3>
            <p>
              Even if the right answer today is "not yet," Atlas helps map a path forward that avoids wasted money and regret.
            </p>
          </div>
        </section>

        <section className="about-section">
          <h2>Why "Atlas"</h2>
          <p>
            In mythology, Atlas held up the sky — bearing a responsibility that mattered to everyone beneath it.
          </p>
          <p>
            Atlas by PHM reflects that same idea:
          </p>
          <ul className="why-atlas-list">
            <li>Supporting homeowners through complex decisions</li>
            <li>Holding together data, tools, and long-term thinking</li>
            <li>Carrying the weight so better outcomes are possible</li>
          </ul>
          <p className="atlas-purpose">
            It's not about selling a product.
            It's about holding the whole picture.
          </p>
        </section>

        <div className="about-footer">
          <p className="about-motto">
            <strong>Atlas by PHM</strong>
          </p>
          <p className="about-motto-tagline">
            Holding the whole picture
          </p>
        </div>
      </div>
    </div>
  );
};
