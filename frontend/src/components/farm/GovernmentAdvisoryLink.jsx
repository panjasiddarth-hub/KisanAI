import { ExternalLink, Landmark } from 'lucide-react';

const IMD_DISTRICT_ADVISORIES = 'https://mausam.imd.gov.in/responsive/agromet_adv_ser_district_current_en.php';
const IMD_DISTRICT_ADVISORIES_LOCAL = 'https://mausam.imd.gov.in/responsive/agromet_adv_ser_district_current_lo.php';
const IMD_CROP_ADVISORIES = 'https://imdagrimet.gov.in/cropAdvisory_3.php';

/** Links farmers to IMD's live district bulletin selector; KisanAI does not fetch or interpret bulletin contents here. */
export default function GovernmentAdvisoryLink({ farm, crop, compact = false }) {
  const district = farm?.district?.trim();
  const state = farm?.state?.trim();
  const locationReady = district && state;

  return (
    <section className={`rounded-xl border border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100 ${compact ? 'p-3' : 'p-4'}`} aria-label="Official government crop advisory">
      <div className="flex items-start gap-2.5">
        <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">Government agromet advisory</h3>
          <p className="mt-1 text-xs leading-relaxed text-sky-900/80 dark:text-sky-100/75">
            {locationReady
            ? `For ${district}, ${state}${crop ? ` · planning crop: ${crop}` : ''}. Open an IMD current district bulletin and select the matching district.`
              : 'Add the farm district and state to identify the right regional bulletin.'}
            {' '}This opens the official live source; KisanAI has not fetched or checked its contents.
          </p>
          {locationReady && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a href={IMD_DISTRICT_ADVISORIES} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 underline decoration-sky-500 underline-offset-2 hover:text-sky-950 dark:text-sky-200 dark:hover:text-white">
              IMD bulletin · English <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a href={IMD_DISTRICT_ADVISORIES_LOCAL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 underline decoration-sky-500 underline-offset-2 hover:text-sky-950 dark:text-sky-200 dark:hover:text-white">
              IMD bulletin · local languages <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>}
          {locationReady && crop && <div className="mt-2 border-t border-sky-200 pt-2 dark:border-sky-900/50">
            <p className="text-[0.68rem] text-sky-900/80 dark:text-sky-100/75">Crop-specific source for {crop}. Select the matching state, district, and crop on IMD; its page says advisories are updated Tuesday and Friday.</p>
            <a href={IMD_CROP_ADVISORIES} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 underline decoration-sky-500 underline-offset-2 hover:text-sky-950 dark:text-sky-200 dark:hover:text-white">
              IMD crop-specific advisory <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>}
        </div>
      </div>
    </section>
  );
}
