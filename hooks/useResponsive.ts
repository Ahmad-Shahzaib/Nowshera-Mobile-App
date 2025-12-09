import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base design sizes (from your Figma or design reference)
const BASE_WIDTH = 375; // iPhone 13 width
const BASE_HEIGHT = 812; // iPhone 13 height

export default function useResponsive() {
  // Scale based on width for font and general sizing
  const scale = width / BASE_WIDTH;
  const verticalScale = height / BASE_HEIGHT;

  /**
   * Scales font size based on screen width
   */
  const fontSize = (size: number) => {
    const newSize = size * scale;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  };

  /**
   * Scales a size (e.g., padding, margin) proportionally to screen width
   */
  const horizontalScale = (size: number) => {
    return Math.round(PixelRatio.roundToNearestPixel(size * scale));
  };

  /**
   * Scales height-based sizes (e.g., vertical padding/margin)
   */
  const vertical = (size: number) => {
    return Math.round(PixelRatio.roundToNearestPixel(size * verticalScale));
  };

  /**
   * Provides screen width and height as well
   */
  return {
    width,
    height,
    fontSize,
    horizontalScale,
    vertical,
    isSmallDevice: width < 360,
    isTablet: width > 768,
    isIOS: Platform.OS === 'ios',
  };
}
