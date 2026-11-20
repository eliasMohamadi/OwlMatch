/** Plain data shapes for the Owl Life PDF ingestion pipeline: PDF → layout → cards → events. */

export interface LayoutText {
  str: string;
  x: number;
  /** Baseline y measured from the top of the page. */
  y: number;
  size: number;
  font: string;
}

export interface LayoutImage {
  id: string;
  page: number;
  x: number;
  top: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface PdfLayout {
  pages: { number: number; width: number; height: number; texts: LayoutText[]; images: LayoutImage[] }[];
}

/** One activity card exactly as printed, before any interpretation. */
export interface RawCard {
  /** 1-based order in the PDF. */
  index: number;
  pages: number[];
  titleLines: string[];
  /** Rows between the title and the "Level" row: location and date lines. */
  detailLines: string[][];
  /** Labels printed above the title, e.g. "RSVPs: 3", "Incentivized Activity". */
  badges: string[];
  level: string | null;
  competencies: string[];
  points: number | null;
  /** "Added by" or "Shared by". */
  attribution: string | null;
  /** Small labels on the attribution row, e.g. "Requires Form Submission". */
  requirements: string[];
  organizers: string[];
  image: LayoutImage | null;
}
