import { parseAssignmentInstructions } from "@/lib/portal/assignment-instructions";
import { cn } from "@/lib/portal/cn";

type Props = {
  value: string;
  className?: string;
};

export function AssignmentInstructions({ value, className }: Props) {
  const blocks = parseAssignmentInstructions(value);
  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed text-foreground/80", className)}>
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <ul key={index} className="space-y-1.5">
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`} className="flex gap-2">
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
