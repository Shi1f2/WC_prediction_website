import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const runtime = "edge";
export const alt = `${SITE_NAME} · 2026 FIFA World Cup Predictions`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(ellipse at top left, #143a26 0%, #061309 55%, #020805 100%)",
          color: "#e6fff0",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#7fffaa",
            fontWeight: 800,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#7fffaa",
              boxShadow: "0 0 24px #7fffaa",
            }}
          />
          WC Prediction League
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              fontStyle: "italic",
              lineHeight: 1.02,
              textTransform: "uppercase",
              letterSpacing: -3,
            }}
          >
            Road to <span style={{ color: "#7fffaa" }}>Glory</span>
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#a8c4b1",
              maxWidth: 980,
              lineHeight: 1.25,
            }}
          >
            Predict every match of the 2026 FIFA World Cup with friends —
            group stage, knockouts, and a live leaderboard.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#7a988a",
            textTransform: "uppercase",
            letterSpacing: 3,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex" }}>Group stage · Knockouts · Bracket</div>
          <div style={{ display: "flex", color: "#7fffaa" }}>
            Predictions lock at kickoff
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
