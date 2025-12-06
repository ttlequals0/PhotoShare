class BaseLocalization {
    constructor(culture, translations) {
        this.culture = culture;
        this.translations = translations;
    }

    translate(key, params) {
        let value = this.translations[key];

        if (value === undefined || value === null || value.length === 0) {
            console.log(`No translation available for key '${key}' under culture '${this.culture}'`);
            return key;
        }

        if (params !== undefined && params !== null) {
            let keys = Object.keys(params);
            if (keys.length > 0) {
                for (let i = 0; i < keys.length; i++) {
                    value = value.replace(new RegExp("{" + keys[i] + "}", 'g'), params[keys[i]]);
                }
            }
        }

        return value;
    }
}