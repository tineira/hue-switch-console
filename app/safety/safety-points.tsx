// The core of the Safety notice, shown in full on /safety and again on /accept
// (docs/specs/terms-and-safety.md §2.6.1).
export const SAFETY_POINTS: { lead: string; body: string }[] = [
  {
    lead: "Mains electricity can kill or start a fire.",
    body: "The in-wall build connects to 220 V or 120 V. Only a qualified electrician should do any mains work, with the circuit switched off at the breaker and checked dead with a tester.",
  },
  {
    lead: "These designs are uncertified.",
    body: "No lab has tested them, and they carry no approval mark (CE, UL, SEC or any other). They may not meet the electrical rules where you live.",
  },
  {
    lead: "These designs are unproven.",
    body: "Some have never been built. Each guide shows its status. Expect mistakes, and report them.",
  },
  {
    lead: "I am not an electrical engineer.",
    body: "This is a hobby project, designed with AI assistance and checked with design-rule tools, not by a qualified engineer.",
  },
  {
    lead: "Rules differ by country.",
    body: "Wire colors, earthing, box sizes, and who may legally do electrical work all vary. In some countries only a licensed electrician may change fixed wiring. Never identify a wire by its color; test it.",
  },
  {
    lead: "Insurance.",
    body: "Installing an uncertified device in your home's wiring may affect your home insurance or your compliance with local building rules. Check before you install.",
  },
  {
    lead: "Low-voltage builds have risks too.",
    body: "Batteries, USB power and soldering can cause burns or damage. Never connect any pin to anything that is or was connected to mains.",
  },
  {
    lead: "You build and install at your own risk.",
    body: "The designs, firmware and instructions are provided “as is”, without warranty of any kind, as their licenses say.",
  },
];

export function SafetyPoints() {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted marker:text-danger">
      {SAFETY_POINTS.map((p) => (
        <li key={p.lead}>
          <strong className="font-medium text-foreground">{p.lead}</strong> {p.body}
        </li>
      ))}
    </ul>
  );
}
