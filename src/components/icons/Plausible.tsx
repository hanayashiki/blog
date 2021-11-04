import { h } from 'preact';
import { IconProps } from './common';

export function Plausible(props: IconProps) {
  const {
    fill,
    size,
  } = props;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 152 216"
      fill={fill ?? "#eeeeee"}
    >
      <mask id="mask0_101:11" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="152" height="216">
        <rect width="152" height="216" />
      </mask>
      <g mask="url(#mask0_101:11)">
        <circle cy="153" r="57" />
        <circle cx="75" cy="78" r="75" />
        <rect x="-2" y="71" width="54" height="77" />
      </g>
    </svg>
  );
}