import { priceGroups } from "@/lib/site";

export default function PriceList() {
  return (
    <section className="section section--alt" id="pricelist">
      <div className="container">
        <div className="section__head">
          <h2 className="section__title">Treatments &amp; Prices</h2>
          <p>Quality nail and hand &amp; foot care, tailored to you.</p>
        </div>

        <div className="price__grid">
          {priceGroups.map((group) => (
            <div className="price-group" key={group.title}>
              <h3 className="price-group__title">{group.title}</h3>
              {group.items.map((item) => (
                <div className="price-row" key={item.name}>
                  <div className="price-row__head">
                    <span className="price-row__name">
                      {item.name}
                      {item.note && (
                        <span className="price-row__note"> · {item.note}</span>
                      )}
                    </span>
                    <span className="price-row__dots" aria-hidden="true" />
                    <span className="price-row__price">{item.price}</span>
                  </div>
                  {item.desc && (
                    <p className="price-row__desc">{item.desc}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
