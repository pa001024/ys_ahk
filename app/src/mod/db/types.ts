import type { Dexie, EntityTable, Version } from "dexie"

declare module "dexie" {
    interface DBTable {
        id: number
    }
    type TypedDB<T extends { [k in keyof T]: DBTable }> = TypedDexie<T> & {
        [k in keyof T]: EntityTable<
            T[k],
            "id" // primary key "id" (for the typings only)
        >
    }

    type Schema<T> = {
        [k in keyof T]: string
    }

    interface TypedDexie<T> extends Dexie {
        version(versionNumber: number): TypedVersion<T>
    }

    interface TypedVersion<T> extends Version {
        stores(schema: Schema<T>): Version
    }
}
