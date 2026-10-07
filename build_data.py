"""Genera viz/data/world.geojson a partir de data/pais_totales.csv.

Incluye todos los países reales del dataset (excluye los agregados: "Total",
los 5 continentes, las 3 regiones de América y "Unión Europea (sin España)" y
"Otros países o territorios de X", que no son países concretos).

Descarga (y cachea en .geo_cache/) la geometría de países de Natural Earth:
- ne_50m_admin_0_countries: mundo a 1:50m (no incluye Gibraltar).
- ne_10m_admin_0_map_units: solo se usa para sacar el polígono de Gibraltar.

Vuelve a ejecutarse cada vez que cambie el CSV de origen (p. ej. tras
re-ejecutar scripts/01_provincia.ipynb con nuevos meses).
"""

import json
import os
import urllib.request

import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIZ_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(VIZ_DIR, ".geo_cache")

NE50_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
MAP_UNITS_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson"

# Nombre del país tal y como aparece en data/pais_totales.csv (columna
# "País", en español, según el estándar de nombres de países del INE) ->
# código ADM0_A3 usado por Natural Earth como id de geometría. Se obtuvo
# cruzando automáticamente contra el campo NAME_ES de Natural Earth (con
# unos pocos alias manuales para los nombres que no coinciden literalmente,
# p. ej. "Swazilandia" -> "Suazilandia").
ISO3 = {
    "Afganistán": "AFG",
    "Albania": "ALB",
    "Alemania": "DEU",
    "Andorra": "AND",
    "Angola": "AGO",
    "Antigua y Barbuda": "ATG",
    "Arabia Saudí": "SAU",
    "Argelia": "DZA",
    "Argentina": "ARG",
    "Armenia": "ARM",
    "Australia": "AUS",
    "Austria": "AUT",
    "Azerbaiyán": "AZE",
    "Bahamas": "BHS",
    "Bahréin": "BHR",
    "Bangladesh": "BGD",
    "Barbados": "BRB",
    "Belarús": "BLR",
    "Bélgica": "BEL",
    "Belice": "BLZ",
    "Benin": "BEN",
    "Bhután": "BTN",
    "Bolivia": "BOL",
    "Bosnia y Herzegovina": "BIH",
    "Botswana": "BWA",
    "Brasil": "BRA",
    "Brunei": "BRN",
    "Bulgaria": "BGR",
    "Burkina Faso": "BFA",
    "Burundi": "BDI",
    "Cabo Verde": "CPV",
    "Camboya": "KHM",
    "Camerún": "CMR",
    "Canadá": "CAN",
    "Chad": "TCD",
    "Chile": "CHL",
    "China": "CHN",
    "Chipre": "CYP",
    "Colombia": "COL",
    "Comores": "COM",
    "Congo": "COG",
    "Corea": "KOR",
    "Corea del Norte": "PRK",
    "Costa de Marfil": "CIV",
    "Costa Rica": "CRI",
    "Croacia": "HRV",
    "Cuba": "CUB",
    "Dinamarca": "DNK",
    "Djibouti": "DJI",
    "Dominica": "DMA",
    "Ecuador": "ECU",
    "Egipto": "EGY",
    "El Salvador": "SLV",
    "Emiratos Árabes Unidos": "ARE",
    "Eritrea": "ERI",
    "Eslovenia": "SVN",
    "Estados Unidos de América": "USA",
    "Estonia": "EST",
    "Etiopía": "ETH",
    "Fiji": "FJI",
    "Filipinas": "PHL",
    "Finlandia": "FIN",
    "Francia": "FRA",
    "Gabón": "GAB",
    "Gambia": "GMB",
    "Georgia": "GEO",
    "Ghana": "GHA",
    "Gibraltar": "GIB",
    "Granada": "GRD",
    "Grecia": "GRC",
    "Guatemala": "GTM",
    "Guinea": "GIN",
    "Guinea Ecuatorial": "GNQ",
    "Guinea-Bissau": "GNB",
    "Guyana": "GUY",
    "Haití": "HTI",
    "Honduras": "HND",
    "Hungría": "HUN",
    "India": "IND",
    "Indonesia": "IDN",
    "Irán": "IRN",
    "Iraq": "IRQ",
    "Irlanda": "IRL",
    "Islandia": "ISL",
    "Islas Cook": "COK",
    "Islas Marshall": "MHL",
    "Islas Salomón": "SLB",
    "Israel": "ISR",
    "Italia": "ITA",
    "Jamaica": "JAM",
    "Japón": "JPN",
    "Jordania": "JOR",
    "Kazajstán": "KAZ",
    "Kenia": "KEN",
    "Kirguistán": "KGZ",
    "Kiribati": "KIR",
    "Kuwait": "KWT",
    "Laos": "LAO",
    "Lesotho": "LSO",
    "Letonia": "LVA",
    "Líbano": "LBN",
    "Liberia": "LBR",
    "Libia": "LBY",
    "Liechtenstein": "LIE",
    "Lituania": "LTU",
    "Luxemburgo": "LUX",
    "Macedonia del Norte": "MKD",
    "Madagascar": "MDG",
    "Malasia": "MYS",
    "Malawi": "MWI",
    "Maldivas": "MDV",
    "Mali": "MLI",
    "Malta": "MLT",
    "Marruecos": "MAR",
    "Mauricio": "MUS",
    "Mauritania": "MRT",
    "México": "MEX",
    "Micronesia": "FSM",
    "Moldavia": "MDA",
    "Mónaco": "MCO",
    "Mongolia": "MNG",
    "Montenegro": "MNE",
    "Mozambique": "MOZ",
    "Myanmar": "MMR",
    "Namibia": "NAM",
    "Nauru": "NRU",
    "Nepal": "NPL",
    "Nicaragua": "NIC",
    "Níger": "NER",
    "Nigeria": "NGA",
    "Noruega": "NOR",
    "Nueva Zelanda": "NZL",
    "Omán": "OMN",
    "Países Bajos": "NLD",
    "Pakistán": "PAK",
    "Palaos": "PLW",
    "Palestina": "PSX",
    "Panamá": "PAN",
    "Papúa Nueva Guinea": "PNG",
    "Paraguay": "PRY",
    "Perú": "PER",
    "Polonia": "POL",
    "Portugal": "PRT",
    "Qatar": "QAT",
    "Reino Unido": "GBR",
    "República Centroafricana": "CAF",
    "República Checa": "CZE",
    "República Democrática del Congo": "COD",
    "República Dominicana": "DOM",
    "República Eslovaca": "SVK",
    "Ruanda": "RWA",
    "Rumanía": "ROU",
    "Rusia": "RUS",
    "Samoa": "WSM",
    "San Cristóbal y Nieves": "KNA",
    "San Marino": "SMR",
    "San Vicente y las Granadinas": "VCT",
    "Santa Lucía": "LCA",
    "Santa Sede": "VAT",
    "Santo Tomé y Príncipe": "STP",
    "Senegal": "SEN",
    "Serbia": "SRB",
    "Seychelles": "SYC",
    "Sierra Leona": "SLE",
    "Singapur": "SGP",
    "Siria": "SYR",
    "Somalia": "SOM",
    "Sri Lanka": "LKA",
    "Sudáfrica": "ZAF",
    "Sudán": "SDN",
    "Sudán del Sur": "SDS",
    "Suecia": "SWE",
    "Suiza": "CHE",
    "Surinam": "SUR",
    "Swazilandia": "SWZ",
    "Tailandia": "THA",
    "Tanzania": "TZA",
    "Tayikistán": "TJK",
    "Timor Oriental": "TLS",
    "Togo": "TGO",
    "Tonga": "TON",
    "Trinidad y Tobago": "TTO",
    "Túnez": "TUN",
    "Turkmenistán": "TKM",
    "Turquía": "TUR",
    "Tuvalu": "TUV",
    "Ucrania": "UKR",
    "Uganda": "UGA",
    "Uruguay": "URY",
    "Uzbekistán": "UZB",
    "Vanuatu": "VUT",
    "Venezuela": "VEN",
    "Vietnam": "VNM",
    "Yemen": "YEM",
    "Zambia": "ZMB",
    "Zimbabwe": "ZWE",
}

JJA_2026 = pd.to_datetime(["2026-06-01", "2026-07-01", "2026-08-01"])


def cached_download(url, filename):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, filename)
    if not os.path.exists(path):
        print(f"Descargando {filename}…")
        urllib.request.urlretrieve(url, path)
    with open(path) as f:
        return json.load(f)


def bbox_of(geometry):
    minx = miny = float("inf")
    maxx = maxy = float("-inf")

    def walk(coords):
        nonlocal minx, miny, maxx, maxy
        if isinstance(coords[0], (int, float)):
            x, y = coords[0], coords[1]
            minx, miny = min(minx, x), min(miny, y)
            maxx, maxy = max(maxx, x), max(maxy, y)
        else:
            for c in coords:
                walk(c)

    walk(geometry["coordinates"])
    return [minx, miny, maxx, maxy]


def ring_area(ring):
    area = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def mainland_bbox(geometry):
    # Para países con territorios de ultramar muy alejados (Francia con la
    # Guayana, Países Bajos con el Caribe, EE.UU. con Alaska/Hawái…) el bbox
    # del multipoligono completo sale enorme e inútil para hacer flyTo.
    # Nos quedamos con el polígono de mayor área (el "continental").
    if geometry["type"] == "Polygon":
        return bbox_of(geometry)
    best = max(geometry["coordinates"], key=lambda poly: ring_area(poly[0]))
    return bbox_of({"type": "Polygon", "coordinates": best})


def main():
    long_df = pd.read_csv(f"{BASE}/data/pais_totales.csv", parse_dates=["Mes"])
    long_df = long_df[long_df["País"].isin(ISO3)]
    df = long_df.pivot(index="Mes", columns="País", values="Total").sort_index()

    jja_mask = df.index.isin(JJA_2026)

    paises = {}
    for nombre_es, iso in ISO3.items():
        serie = [
            {"mes": mes.strftime("%Y-%m"), "valor": (None if pd.isna(v) else int(v))}
            for mes, v in df[nombre_es].items()
        ]
        paises[iso] = {
            "nombre": nombre_es,
            "jja2026": int(df.loc[jja_mask, nombre_es].sum()),
            "serie": serie,
        }

    ne50 = cached_download(NE50_URL, "ne_50m_admin_0_countries.geojson")
    map_units = cached_download(MAP_UNITS_URL, "ne_10m_admin_0_map_units.geojson")
    gib = next(f for f in map_units["features"] if f["properties"].get("NAME") == "Gibraltar")

    def to_feature(geometry, iso, name):
        out_props = {"iso_a3": iso, "name": name}
        if iso in paises:
            out_props.update(
                {
                    "nombre_es": paises[iso]["nombre"],
                    "jja2026": paises[iso]["jja2026"],
                    "serie_json": json.dumps(paises[iso]["serie"], ensure_ascii=False),
                }
            )
            minx, miny, maxx, maxy = mainland_bbox(geometry)
            out_props.update({"bbox_minx": minx, "bbox_miny": miny, "bbox_maxx": maxx, "bbox_maxy": maxy})
        return {"type": "Feature", "properties": out_props, "geometry": geometry}

    features = [
        to_feature(f["geometry"], f["properties"].get("ADM0_A3"), f["properties"].get("NAME"))
        for f in ne50["features"]
    ]
    features.append(to_feature(gib["geometry"], "GIB", "Gibraltar"))

    world = {"type": "FeatureCollection", "features": features}

    out_path = os.path.join(VIZ_DIR, "data", "world.geojson")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(world, f, ensure_ascii=False, separators=(",", ":"))

    encontrados = sum(1 for iso in ISO3.values() if any(ft["properties"].get("iso_a3") == iso for ft in features))
    print(f"world.geojson escrito ({len(features)} features, {encontrados}/{len(ISO3)} países con datos encontrados en la geometría)")
    print("Tamaño (MB):", round(os.path.getsize(out_path) / 1e6, 2))


if __name__ == "__main__":
    main()
