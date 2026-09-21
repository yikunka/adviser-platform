import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SFS_KNOWLEDGE = `
## About SFS Technology Group
SFS Technology Group manufactures memorial diamonds in Hong Kong for professional distributors. The public website is for those partners. Families are served through a distributor, not by ordering on this site. We own and operate our laboratory and CVD factory. Contact: +86 19129444364 (phone / WhatsApp) | patricklau@sfsdiamonds.com | Address: Yau Ma Tei, Hong Kong.

## Memorial Diamond Services
- Transform cremated ashes or hair into a real certified diamond
- Pet remains also accepted (sister brand: Gempets)
- Materials required: 60g bone ashes OR 1g hair (both can be combined)
- Any unused remains can be returned or scattered per family wishes
- Each stone has a unique ID linked to the original remains (full traceability)
- Production time: approximately 2–3 months from carbon extraction to delivery
- 4C certified (Colour, Clarity, Cut, Carat Weight) by international standards
- Pricing: Contact for consultation — varies by carat weight and specifications

## CVD Technology (Chemical Vapor Deposition)
CVD grows diamonds by introducing carbon-rich gas into a vacuum chamber and activating it with microwave plasma. Carbon atoms are deposited layer by layer onto a diamond seed, forming a real crystalline diamond. It requires no metal catalysts (unlike HPHT), making it the purest method available. CVD-grown memorial diamonds have the same physical, chemical, and optical properties as natural diamonds.

## Diamond Colours
CVD-grown memorial diamonds typically show shades of yellow. The variation from light to deep yellow depends on the nitrogen content in the carbon source. SFS does not artificially alter the colour — the hue reflects the natural composition of the loved one's remains.

## Production Process
Step 1 — Carbon Extraction: Labelling & Tracking → Grinding (milled to increase surface area) → Chemical Purification (removing calcium phosphate and minerals) → High-Temperature Treatment (oxygen-free to prevent oxidation) → Vaporisation (carbon converted to gas form).
Step 2 — CVD Growth: Seed Preparation (diamond seed crystal placed in vacuum chamber) → Carbon Gas Introduction → Plasma Activation (microwave plasma breaks down gas, releasing carbon atoms) → Layer-by-Layer Growth (weeks to months depending on desired carat) → Post-Growth Treatment.
Step 3 — Crafting: Marking → 3D Scanning → Cutting Design → Laser Cut → Polish → Quality Control & Certification.

## FAQ
Q: How much bone ash or hair is needed?
A: 60 grams of bone ashes or 1 gram of hair per diamond. Both can be combined.

Q: Do you use all the ashes provided?
A: Only a portion is needed. Unused remains can be returned or scattered per your wishes.

Q: How do I prepare and send the ashes?
A: We provide a secure collection box. You can deliver directly to our Yau Ma Tei office or use our verified courier service.

Q: What if I don't have enough bone ashes?
A: Supplement with hair, or we can extract carbon from personal belongings (clothing, stuffed toys, shoes, books).

Q: Are memorial diamonds real diamonds?
A: Yes. Same physical, chemical, and optical properties as natural diamonds. Graded and certified by international 4C standards.

Q: How long does production take?
A: Approximately 2–3 months from carbon extraction to delivery.

Q: Why do memorial diamonds have different colours?
A: CVD diamonds typically show yellow shades. Variation depends on nitrogen content in the carbon source. SFS does not artificially alter the colour.

Q: Why choose SFS Technology?
A: We own and operate our own laboratory and CVD factory — complete quality control, full traceability (unique ID per stone), rigorous 4C certification, and a team that treats every commission with deep respect.

Q: Can I use pet remains?
A: Yes. Our sister brand Gempets specialises in memorial diamonds from pet remains. Same CVD process and quality standards.

Q: What is CVD technology?
A: Chemical Vapor Deposition grows diamonds from carbon-rich gas in a vacuum chamber activated by microwave plasma. Carbon atoms deposit layer by layer on a diamond seed. The purest method available — no metal catalysts required.

## Product images
All product images on the website are for illustrative and reference purposes only. Lighting, shooting angle, screen resolution, colour calibration, and individual diamond cutting can make the physical product look different in appearance, colour, brilliance, and details. No website image is an exact contractual representation of the final product. Sales are based on the actual item received and the official IGI certificate specifications.
`

const SYSTEM_PROMPT = `You are SFS Diamond's friendly and compassionate AI assistant. You help visitors understand our memorial diamond services, CVD technology, and the process of creating a diamond from cremated ashes or hair.

Guidelines:
- Be warm and precise. Visitors are usually prospective distributors, not the bereaved family
- If a family member writes, explain that orders go through an approved distributor and offer the phone number and email
- Answer questions accurately based on the knowledge below
- For specific pricing, recommend contacting us directly: +86 19129444364 (phone / WhatsApp) or patricklau@sfsdiamonds.com
- If asked something outside your knowledge, gracefully suggest they contact us
- Keep responses concise (2–4 sentences) unless a detailed explanation is needed
- You can respond in the language the user writes in (English or Chinese)

${SFS_KNOWLEDGE}`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 503 })
  }

  const messages = (body.messages as { role: string; content: string }[]).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }
      try {
        const anthropic = new Anthropic({ apiKey })
        const sdkStream = anthropic.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages,
        })
        for await (const chunk of sdkStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            send({ type: 'text', text: chunk.delta.text })
          }
        }
        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Request failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
