type Props = {
  code: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

// Rendered (CSS) widths
const W = { sm: 20, md: 32, lg: 60 } as const;
// Fetch widths — flagcdn only serves standard sizes (20/40/80/160/320/...)
const FETCH = { sm: 40, md: 80, lg: 160 } as const;

export default function Flag({ code, size = "md", className = "" }: Props) {
  const w = W[size];
  const c = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w${FETCH[size]}/${c}.png`}
      width={w}
      height={Math.round(w * 0.75)}
      alt=""
      loading="lazy"
      className={`inline-block rounded-sm shadow-sm shadow-black/40 ${className}`}
    />
  );
}
