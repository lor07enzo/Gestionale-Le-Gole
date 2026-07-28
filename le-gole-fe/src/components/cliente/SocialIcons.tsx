import Svg, { Circle, Path, Rect } from 'react-native-svg';

type SocialIconProps = {
  size?: number;
  color?: string;
};

export function InstagramIcon({ size = 20, color = '#fff' }: Readonly<SocialIconProps>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="5" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={1.8} />
      <Circle cx="17.2" cy="6.8" r="1.1" fill={color} />
    </Svg>
  );
}

export function FacebookIcon({ size = 20, color = '#fff' }: Readonly<SocialIconProps>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 8.5H16.5V5.5H14.5C12.57 5.5 11 7.07 11 9V11H9V14H11V20H14V14H16.3L16.8 11H14V9.5C14 8.95 14.45 8.5 14.5 8.5Z"
        fill={color}
      />
    </Svg>
  );
}

export function WhatsAppIcon({ size = 20, color = '#fff' }: Readonly<SocialIconProps>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3C7.03 3 3 7.03 3 12C3 13.6 3.42 15.1 4.16 16.39L3 21L7.73 19.86C8.97 20.57 10.44 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 8.7C8.7 8.2 8.9 8.2 9.1 8.2H9.6C9.75 8.2 9.95 8.2 10.1 8.6C10.3 9.1 10.7 10.1 10.75 10.2C10.8 10.3 10.85 10.45 10.75 10.6C10.65 10.75 10.6 10.85 10.45 11C10.3 11.15 10.15 11.3 10.3 11.55C10.45 11.8 10.95 12.6 11.7 13.25C12.65 14.1 13.4 14.35 13.65 14.5C13.9 14.6 14.05 14.6 14.2 14.45C14.35 14.3 14.8 13.75 14.95 13.5C15.1 13.25 15.25 13.3 15.45 13.35C15.65 13.45 16.75 13.95 16.95 14.05C17.15 14.15 17.3 14.2 17.35 14.3C17.4 14.4 17.4 14.85 17.2 15.4C17 15.9 16.05 16.4 15.6 16.45C15.2 16.5 14.7 16.55 14.1 16.35C13.75 16.25 13.3 16.1 12.7 15.85C10.25 14.8 8.65 12.35 8.55 12.2C8.45 12.05 7.7 11.05 7.7 10C7.7 8.95 8.25 8.45 8.5 8.7Z"
        fill={color}
      />
    </Svg>
  );
}
