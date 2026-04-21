/**
 * Publishable — shared interface mixin for domain entities that can be
 * published/unpublished and queried by publication state.
 *
 * Both FleaMarketRepository and RouteRepository compose this via intersection.
 */
export interface Publishable {
  publish(id: string): Promise<void>
  unpublish(id: string): Promise<void>
}
