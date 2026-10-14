import {
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  LockKeyhole,
  XCircle,
} from "lucide-react";
import { STATUS_LABELS, type Status } from "../../shared/status";
import s from "./StatusBadge.module.scss";
const icons = {
  available: CheckCircle2,
  unavailable: XCircle,
  restricted: LockKeyhole,
  inconclusive: CircleHelp,
  unchecked: CircleDashed,
};
export function StatusBadge({ status }: { status: Status }) {
  const Icon = icons[status];
  return (
    <span className={`${s.badge} ${s[status]}`}>
      <Icon size={14} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
