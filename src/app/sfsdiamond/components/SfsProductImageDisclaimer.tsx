export default function SfsProductImageDisclaimer({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={className} style={style}>
      <p>Disclaimer：All product images displayed on this website are for illustrative and reference purposes only.</p>
      <p>Due to differences in lighting, shooting angles, screen resolution, colour calibration, and individual diamond cutting characteristics, the actual physical product may vary in appearance, colour, brilliance and details from the online images.</p>
      <p>No image displayed on this website constitutes an exact contractual representation of the final product. All sales are based on the actual item received and official IGI certificate specifications.</p>
    </div>
  )
}
