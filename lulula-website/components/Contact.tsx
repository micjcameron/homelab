"use client";

import { useState } from "react";
import { site, openingHours } from "@/lib/site";
import {
  IconWhatsApp,
  IconFacebook,
  IconInstagram,
  IconClock,
  IconMapPin,
  IconMail,
} from "./icons";

const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;

type Status = "idle" | "sending" | "ok" | "error";

export default function Contact() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = new FormData(form);
    data.append("access_key", WEB3FORMS_KEY ?? "");
    data.append("subject", "New enquiry from lulula.nl");
    data.append("from_name", "Lulula website");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (json.success) {
        setStatus("ok");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="section section--alt" id="contact-me">
      <div className="container">
        <div className="section__head">
          <span className="section__eyebrow">Get in touch</span>
          <h2 className="section__title">Contact Me</h2>
          <p>
            Questions or ready to book? Send a message or reach out on WhatsApp.
          </p>
        </div>

        <div className="contact__grid">
          <div className="contact__info">
            <a
              className="contact__book"
              href={site.booking}
              target="_blank"
              rel="noopener noreferrer"
            >
              Or make a booking here →
            </a>

            <div className="contact__block">
              <h3>
                <IconClock />
                Opening hours
              </h3>
              <table className="hours-table">
                <tbody>
                  {openingHours.map((row) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>{row.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="contact__block">
              <h3>
                <IconMapPin />
                Location
              </h3>
              <p>{site.location}</p>
              <a
                className="contact__directions"
                href={site.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions →
              </a>
            </div>

            <div className="contact__block">
              <h3>
                <IconMail />
                Contact details
              </h3>
              <p>
                <a href={`mailto:${site.email}`}>{site.email}</a>
                <br />
                <a
                  href={site.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp {site.phoneDisplay}
                </a>
              </p>
              <div className="socials">
                <a
                  className="social social--whatsapp"
                  href={site.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                >
                  <IconWhatsApp />
                </a>
                <a
                  className="social social--facebook"
                  href={site.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <IconFacebook />
                </a>
                <a
                  className="social social--instagram"
                  href={site.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <IconInstagram />
                </a>
              </div>
            </div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            {/* Honeypot — bots fill this, humans never see it. */}
            <input
              type="checkbox"
              name="botcheck"
              className="honeypot"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" required />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone number</label>
              <input id="phone" name="phone" type="tel" required />
            </div>
            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea id="message" name="message" />
            </div>

            <button
              className="btn btn--primary"
              type="submit"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send Message"}
            </button>

            {status === "ok" && (
              <p className="form__status form__status--ok">
                Thank you! Your message has been sent — I&apos;ll be in touch soon.
              </p>
            )}
            {status === "error" && (
              <p className="form__status form__status--err">
                Something went wrong. Please email {site.email} or message me on
                WhatsApp.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
