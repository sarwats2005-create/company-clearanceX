import { File06, Printer } from "@untitledui/icons";
import { DownloadLink } from "@/components/app/download-link";
import { CardTitle } from "@/components/app/icon-tile";
import { WhatsAppShareButton } from "@/components/app/whatsapp-share";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { CURRENCY_IN, LEDGER_KIND, type StatementParams, defaultCurrency, rangeText, statementQuery, statementShareText } from "@/features/accounts/model";
import { type StatementTarget, balancesAsOf } from "@/features/accounts/queries";
import { getStatement } from "@/features/ledger/statements";
import { getCompanyName } from "@/features/settings/queries";
import { StatementFilters } from "./statement-filters";
import { StatementTable } from "./statement-table";

/** The statement block of a trader, party or vault page: filters, print / WhatsApp, and the table (PRD §8.8). */
export async function StatementSection({ target, params }: { target: StatementTarget; params: StatementParams }) {
    const currency = defaultCurrency(target.currencies, target.balance, params.currency);
    const kind = LEDGER_KIND[target.segment];
    const isVault = target.segment === "vaults";
    const [st, closing, company] = await Promise.all([
        getStatement(db, { kind, refId: target.id }, currency, params.from, params.to),
        isVault ? null : balancesAsOf(db, kind, target.id, params.to),
        isVault ? null : getCompanyName(),
    ]);
    const query = statementQuery({ ...params, currency }, {});
    const printHref = `/print/statement/${target.segment}/${target.id}${query}${query ? "&" : "?"}autoprint=1`;
    const share =
        closing && company !== null ? statementShareText({ company, title: target.title, from: params.from, to: params.to, balances: closing }) : null;

    return (
        <section id="statement-doc" aria-labelledby="statement-title" className="surface flex flex-col gap-5 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle id="statement-title" icon={File06} color="indigo" title={isVault ? "حركة القاصة" : "كشف الحساب"} />
                <div className="no-print flex flex-wrap gap-2">
                    <Button size="md" color="secondary" iconLeading={<Printer data-icon aria-hidden="true" />} href={printHref} target="_blank" rel="noopener">
                        طباعة
                    </Button>
                    <DownloadLink size="md" href={`/export/statement/${target.segment}/${target.id}${query}`}>
                        Excel
                    </DownloadLink>
                    {share && <WhatsAppShareButton size="md" text={share} phone={target.phone} targetId="statement-doc" fileName={`كشف حساب ${target.title}`} label="واتساب" />}
                </div>
            </div>
            <div className="no-print">
                <StatementFilters params={params} currency={currency} currencies={target.currencies} />
            </div>
            <p className="text-sm text-tertiary">
                {rangeText(params.from, params.to)} · {CURRENCY_IN[currency]}
            </p>
            <StatementTable statement={st} currency={currency} mode={isVault ? "vault" : "account"} showOpening={!!params.from} />
        </section>
    );
}
