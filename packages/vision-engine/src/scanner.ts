/**
 * ArUcoScanner - Computer vision logic for ArUco marker detection
 * 
 * Detects ArUco markers in images and calculates scale information
 * based on a reference marker (ID 42) on a standard credit card.
 */

// OpenCV.js is loaded globally
declare const cv: any;

// Constants for reference object (ISO 7810 Credit Card)
const ID_CARD_WIDTH_MM = 85.60;
const ID_CARD_MARKER_ID = 42;

// Expected aspect ratio of a credit card (approx 85.6mm / 54mm)
const EXPECTED_ASPECT_RATIO = 1.58;
const TILT_TOLERANCE = 0.20; // 20% tolerance

/**
 * Represents a detected ArUco marker
 */
export interface DetectedMarker {
  id: number;
  corners: number[][];
}

/**
 * Scale data calculated from the reference marker
 */
export interface ScaleData {
  pixelsPerMm: number;
}

/**
 * Result from the detect() method
 */
export interface DetectionResult {
  markers: DetectedMarker[];
  scaleData?: ScaleData;
  isTilted?: boolean;
}

/**
 * ArUcoScanner class for detecting and measuring ArUco markers
 */
export class ArUcoScanner {
  /**
   * Detect ArUco markers in an image and calculate scale information
   * 
   * @param imageSource - HTML image or canvas element to process
   * @returns Detection result with markers and optional scale data
   */
  detect(imageSource: HTMLImageElement | HTMLCanvasElement): DetectionResult {
    let src: any = null;
    let gray: any = null;
    let ids: any = null;
    let corners: any = null;

    try {
      // Read image into cv.Mat
      src = cv.imread(imageSource);

      // Convert to grayscale
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Prepare marker detection
      ids = new cv.Mat();
      corners = new cv.MatVector();

      // Detect markers using DICT_6X6_250 dictionary
      const dictionary = new cv.aruco_Dictionary(cv.aruco.DICT_6X6_250);
      const parameters = new cv.aruco_DetectorParameters();

      cv.detectMarkers(gray, dictionary, corners, ids, parameters);

      // Parse detected markers
      const markers: DetectedMarker[] = [];
      let scaleData: ScaleData | undefined;
      let isTilted: boolean | undefined;

      if (ids.rows > 0) {
        for (let i = 0; i < ids.rows; i++) {
          const markerId = ids.data32S[i];
          const corner = corners.get(i);

          // Extract corner coordinates
          const cornerPoints: number[][] = [];
          for (let j = 0; j < 4; j++) {
            cornerPoints.push([
              corner.data32F[j * 2],
              corner.data32F[j * 2 + 1]
            ]);
          }

          markers.push({
            id: markerId,
            corners: cornerPoints
          });

          // Check if this is the reference marker (ID 42)
          if (markerId === ID_CARD_MARKER_ID) {
            // Calculate width: Euclidean distance between top-left and top-right corners
            const topLeft = cornerPoints[0];
            const topRight = cornerPoints[1];
            const dx = topRight[0] - topLeft[0];
            const dy = topRight[1] - topLeft[1];
            const distanceInPixels = Math.sqrt(dx * dx + dy * dy);

            // Calculate pixels per mm
            const pixelsPerMm = distanceInPixels / ID_CARD_WIDTH_MM;
            scaleData = { pixelsPerMm };

            // Calculate marker dimensions for tilt detection
            const bottomRight = cornerPoints[2];
            const rightDx = bottomRight[0] - topRight[0];
            const rightDy = bottomRight[1] - topRight[1];
            const markerHeight = Math.sqrt(rightDx * rightDx + rightDy * rightDy);
            const markerWidth = distanceInPixels;

            // Calculate aspect ratio and check for tilt (guard against division by zero)
            if (markerHeight > 0) {
              const aspectRatio = markerWidth / markerHeight;
              const deviation = Math.abs(aspectRatio - EXPECTED_ASPECT_RATIO) / EXPECTED_ASPECT_RATIO;

              isTilted = deviation > TILT_TOLERANCE;
            }
          }

          // Clean up corner
          corner.delete();
        }
      }

      // Clean up dictionary and parameters
      dictionary.delete();
      parameters.delete();

      // Build result
      const result: DetectionResult = { markers };
      if (scaleData) {
        result.scaleData = scaleData;
      }
      if (isTilted !== undefined) {
        result.isTilted = isTilted;
      }

      return result;
    } finally {
      // Critical: Clean up all cv.Mat objects to prevent memory leaks
      if (src) src.delete();
      if (gray) gray.delete();
      if (ids) ids.delete();
      if (corners) corners.delete();
    }
  }
}
