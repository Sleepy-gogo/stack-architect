import { createElement } from "react"
import {
  BellIcon,
  BoxIcon,
  CloudIcon,
  DatabaseIcon,
  HardDriveIcon,
  LayersIcon,
  MonitorIcon,
  ServerIcon,
  SmartphoneIcon,
  TimerIcon,
  ZapIcon,
} from "lucide-react"
import { getBrandIcon, getSvglIcon } from "@/lib/icons"

type SvgComponent = (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element

function SvglMark({
  mark,
  ...props
}: { mark: SvgComponent } & React.SVGProps<SVGSVGElement>) {
  return createElement(mark, { "aria-hidden": true, focusable: "false", ...props })
}

const genericIcons: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  browser: MonitorIcon,
  mobile: SmartphoneIcon,
  service: ServerIcon,
  datastore: DatabaseIcon,
  queue: LayersIcon,
  cache: ZapIcon,
  cdn: CloudIcon,
  cron: TimerIcon,
  bucket: HardDriveIcon,
  thirdparty: BellIcon,
}

export function BrandIcon({
  slug,
  className,
  size = 28,
}: {
  slug: string
  className?: string
  size?: number
}) {
  const Generic = genericIcons[slug]
  if (Generic) {
    return (
      <Generic
        width={size}
        height={size}
        strokeWidth={1.5}
        className={className}
        aria-hidden="true"
        focusable="false"
      />
    )
  }

  const svgl = getSvglIcon(slug)
  if (svgl) {
    return (
      <SvglMark
        mark={svgl}
        width={size}
        height={size}
        className={className}
      />
    )
  }

  const icon = getBrandIcon(slug)
  if (!icon) {
    return (
      <BoxIcon
        width={size}
        height={size}
        strokeWidth={1.5}
        className={className}
        aria-hidden="true"
        focusable="false"
      />
    )
  }

  const fill = icon.hex.toLowerCase() === "#ffffff" ? "currentColor" : icon.hex

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.path} fill={fill} />
    </svg>
  )
}
