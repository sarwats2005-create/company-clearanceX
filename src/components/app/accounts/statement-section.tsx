import { MessageChatCircle, Printer } from "@untitledui/icons";
import { DownloadLink } from "@/components/app/download-link";
import { Button } from "@/components/base/buttons/button";
import { db } from "@/db";
import { CURRENCY_IN, LEDGER_KIND, type StatementParams, defaultCurrency, rangeText, statementQuery, statementShareText } from "@/features/accounts/model";
import { type StatementTarget, balancesAsOf } from "@/features/accounts/queries";
import { getStatement } from "@/features/ledger/statements";
import { getCompanyName } from "@/features/settings/queries";
import { whatsappUrl } from "@/lib/whatsapp";
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
        closing && company !== null
            ? whatsappUrl(target.phone, statementShareText({ company, title: target.title, from: params.from, to: params.to, balances: closing }))
            : null;

    return (
        <section aria-labelledby="statement-title" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="statement-title" className="text-lg font-semibold text-primary">
                    {isVault ? "حركة القاصة" : "كشف الحساب"}
                </h2>
                <div className="no-print flex flex-wrap gap-2">
                    <Button size="md" color="secondary" iconLeading={<Printer data-icon aria-hidden="true" />} href={printHref} target="_blank" rel="noopener">
                        طباعة
                    </Button>
                    <DownloadLink size="md" href={`/export/statement/${target.segment}/${target.id}${query}`}>
                        Excel
                    </DownloadLink>
                    {share && (
                        <Button
                            size="md"
                            color="secondary"
                            iconLeading={<MessageChatCircle data-icon aria-hidden="true" />}
                            href={share}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            واتساب
                        </Button>
                    )}
                </div>
            </div>
            <StatementFilters params={params} currency={currency} currencies={target.currencies} />
            <p className="text-sm text-tertiary">
                {rangeText(params.from, params.to)} · {CURRENCY_IN[currency]}
            </p>
            <StatementTable statement={st} currency={currency} mode={isVault ? "vault" : "account"} showOpening={!!params.from} />
        </section>
    );
}
