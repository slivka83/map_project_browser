// d3-geo-projection v4 ships no type declarations and @types/d3-geo-projection
// does not exist. Declare only the members this app uses.
declare module 'd3-geo-projection' {
  import type { GeoProjection } from 'd3-geo';

  export interface GeoCylindricalEqualArea extends GeoProjection {
    parallel(angle: number): GeoCylindricalEqualArea;
  }

  export function geoCylindricalEqualArea(): GeoCylindricalEqualArea;
}
