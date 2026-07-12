import type { GeoProjection } from 'd3-geo';
// d3-geo-projection v4 ships no type declarations and @types/d3-geo-projection
// does not exist, so we wrap the one function we use with a precise type.
// @ts-expect-error - no type declarations for 'd3-geo-projection'
import { geoCylindricalEqualArea as _geoCylindricalEqualArea } from 'd3-geo-projection';

export const geoCylindricalEqualArea = _geoCylindricalEqualArea as () => GeoProjection & {
  parallel(angle: number): GeoProjection;
};
