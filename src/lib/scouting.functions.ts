import { createServerFn } from "@tanstack/react-start";

export type ScoutPlayer = {
  id: string;
  name: string;
  role: string; // 포지션 또는 "투수"
  hand: string;
  stats: string; // 능력치 요약
  valueRange: string; // 예상 시장가치 범위 (예: "300만$~480만$")
  from: string;
};

export type ScoutResult = { reports: Record<string, string>; error?: string };

function validate(input: unknown): { players: ScoutPlayer[] } {
  const players = (input as { players?: unknown })?.players;
  if (!Array.isArray(players)) throw new Error("잘못된 요청");
  const clean = players.slice(0, 12).map((p) => {
    const o = p as Record<string, unknown>;
    const s = (v: unknown, n = 120) => String(v ?? "").slice(0, n);
    return { id: s(o.id, 40), name: s(o.name, 40), role: s(o.role, 20), hand: s(o.hand, 10), stats: s(o.stats, 200), valueRange: s(o.valueRange, 40), from: s(o.from, 20) };
  });
  return { players: clean };
}

export const scoutListings = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }): Promise<ScoutResult> => {
    if (!data.players.length) return { reports: {} };
    const { generateResponse, GatewayError, PaymentRequiredError, RateLimitError } = await import("@lovable.dev/ai-gateway");
    const list = data.players
      .map((p) => `- id=${p.id} | ${p.name} | ${p.from} | ${p.role} | ${p.hand} | ${p.stats} | 예상 몸값 ${p.valueRange}`)
      .join("\n");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        instructions:
          "너는 KBO 구단의 베테랑 스카우터다. 능력치는 1~10 척도(구속은 km/h)다. 각 선수마다 한국어 2문장 이내(90자 안팎)로 강점·약점과 예상 몸값 범위 대비 가성비(저평가/적정/고평가)와 적정 오퍼 수준을 판단한 짧은 스카우팅 리포트를 써라. 주어진 범위 밖의 정확한 금액을 지어내지 말고, 과장 없이 구체적으로.",
        input: [{ role: "user", content: `다음 이적시장 매물의 스카우팅 리포트를 JSON으로 작성해줘.\n${list}` }],
        text: {
          format: {
            type: "json_schema",
            name: "scouting_reports",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["reports"],
              properties: {
                reports: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "report"],
                    properties: { id: { type: "string" }, report: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") for (const c of item.content) if (c.type === "output_text") text += c.text;
      }
      const parsed = JSON.parse(text) as { reports: { id: string; report: string }[] };
      const reports: Record<string, string> = {};
      for (const r of parsed.reports) if (data.players.some((p) => p.id === r.id)) reports[r.id] = r.report;
      return { reports };
    } catch (e) {
      console.error("scouting failed", e);
      if (e instanceof PaymentRequiredError) return { reports: {}, error: "AI 크레딧이 부족해 리포트를 쓰지 못했습니다." };
      if (e instanceof RateLimitError) return { reports: {}, error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." };
      if (e instanceof GatewayError) return { reports: {}, error: "스카우터가 지금 응답하지 않습니다. 잠시 후 다시 시도해 주세요." };
      return { reports: {}, error: "리포트를 읽는 중 문제가 생겼습니다." };
    }
  });
