/**
 * Taxonomy matching seam.
 *
 * The ValueXtract taxonomy is deliberately NOT embedded in the analysis
 * prompt or in this module. The Skill returns `trigger_id`, `service_line`
 * and `agri_category`; this interface is where those are later resolved
 * against the ValueXtract taxonomy database, then on to referral partners,
 * internal service lines and CapMatch.
 *
 *   Claude analysis -> trigger id -> taxonomy -> service opportunity
 *                                            -> referral partner / internal
 *                                            -> CapMatch (funding triggers)
 *
 * The default implementation is a pass-through recorder: it preserves the
 * identifiers and reports "unmatched", so no fabricated mapping is ever
 * persisted. Replace `setTaxonomyResolver` with a database-backed resolver
 * when the taxonomy tables land, and nothing else in the pipeline changes.
 */

export type TriggerInput = {
  triggerId: string;
  serviceLine: string;
  agriCategory: string;
  opportunityName: string;
};

export type TaxonomyMatch = {
  triggerId: string;
  matched: boolean;
  taxonomyNodeId?: string;
  taxonomyServiceLine?: string;
  referralPartnerId?: string;
  deliveryMode?: "INTERNAL" | "REFERRAL" | "CAPMATCH";
  notes?: string;
};

export type TaxonomyResolver = (triggers: TriggerInput[]) => Promise<TaxonomyMatch[]>;

const passthroughResolver: TaxonomyResolver = async (triggers) =>
  triggers.map((t) => ({
    triggerId: t.triggerId,
    matched: false,
    notes: "No taxonomy resolver configured; trigger identifiers preserved for later matching.",
  }));

let resolver: TaxonomyResolver = passthroughResolver;

export function setTaxonomyResolver(next: TaxonomyResolver): void {
  resolver = next;
}

export async function matchTriggersToTaxonomy(
  triggers: TriggerInput[],
): Promise<TaxonomyMatch[]> {
  if (triggers.length === 0) return [];
  return resolver(triggers);
}
