import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Fyndstigen — Hitta loppisar nära dig";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fraunces = await readFile(
    join(process.cwd(), "src/app/fonts/fraunces-bold.ttf")
  );
  const nunito = await readFile(
    join(process.cwd(), "src/app/fonts/nunito-regular.ttf")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#F2EBE0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Paper grain texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(212,160,67,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(168,75,42,0.06) 0%, transparent 50%)",
            display: "flex",
          }}
        />

        {/* Top accent bar — brand gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#A84B2A" }} />
          <div style={{ flex: 1, background: "#D4A043" }} />
          <div style={{ flex: 1, background: "#496342" }} />
          <div style={{ flex: 1, background: "#9B8EA8" }} />
        </div>

        {/* Trail SVG decoration */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: "absolute", inset: 0 }}
        >
          <path
            d="M-20 520 C80 480, 160 500, 200 440 C240 380, 180 340, 260 300 C340 260, 400 280, 440 220 C480 160, 420 120, 520 100 C620 80, 680 140, 760 100 C840 60, 900 80, 980 40 C1060 0, 1120 30, 1220 -10"
            stroke="#2C241D"
            strokeWidth="3"
            strokeDasharray="10 8"
            strokeLinecap="round"
            fill="none"
            opacity="0.07"
          />
          {/* Trail dots */}
          <circle cx="200" cy="440" r="6" fill="#A84B2A" opacity="0.12" />
          <circle cx="440" cy="220" r="6" fill="#D4A043" opacity="0.12" />
          <circle cx="760" cy="100" r="6" fill="#496342" opacity="0.12" />
          <circle cx="980" cy="40" r="6" fill="#9B8EA8" opacity="0.12" />
        </svg>

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            position: "relative",
          }}
        >
          {/* Logo mark */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 64 64"
            fill="none"
          >
            <circle cx="10" cy="52" r="5" fill="#A84B2A" opacity="0.85" />
            <path
              d="M14 48 C20 38, 28 36, 24 26 C20 16, 32 12, 38 10 C44 8, 48 14, 52 8"
              stroke="#2C241D"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
              fill="none"
              opacity="0.3"
            />
            <circle cx="24" cy="26" r="2.2" fill="#D4A043" opacity="0.7" />
            <circle cx="38" cy="10" r="2.2" fill="#496342" opacity="0.7" />
            <path
              d="M50 10 L58 4"
              stroke="#2C241D"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.5"
            />
            <path
              d="M53 2 L59 3 L57 9"
              stroke="#2C241D"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.5"
            />
          </svg>

          {/* Title */}
          <div
            style={{
              fontFamily: "Fraunces",
              fontSize: 72,
              fontWeight: 700,
              color: "#2C241D",
              letterSpacing: "-1px",
            }}
          >
            Fyndstigen
          </div>

          {/* Tagline */}
          <div
            style={{
              fontFamily: "Nunito",
              fontSize: 28,
              color: "#4A3F34",
              opacity: 0.7,
              letterSpacing: "0.5px",
            }}
          >
            Hitta loppisar nära dig
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 16,
            }}
          >
            {[
              { text: "Sök loppisar", color: "#A84B2A" },
              { text: "Boka bord", color: "#D4A043" },
              { text: "Planera rundor", color: "#496342" },
            ].map((pill) => (
              <div
                key={pill.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.5)",
                  border: `1.5px solid ${pill.color}33`,
                  borderRadius: 999,
                  padding: "8px 20px",
                  fontFamily: "Nunito",
                  fontSize: 18,
                  color: "#2C241D",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: pill.color,
                  }}
                />
                {pill.text}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Nunito",
            fontSize: 16,
            color: "#2C241D",
            opacity: 0.35,
          }}
        >
          fyndstigen.se
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Fraunces",
          data: fraunces,
          style: "normal",
          weight: 700,
        },
        {
          name: "Nunito",
          data: nunito,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
