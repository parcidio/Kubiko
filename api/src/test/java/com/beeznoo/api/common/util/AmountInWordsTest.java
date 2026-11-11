package com.beeznoo.api.common.util;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class AmountInWordsTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "0|zero kwanzas",
            "1|um kwanza",
            "2|dois kwanzas",
            "16|dezasseis kwanzas",
            "21|vinte e um kwanzas",
            "100|cem kwanzas",
            "101|cento e um kwanzas",
            "999|novecentos e noventa e nove kwanzas",
            "1000|mil kwanzas",
            "1001|mil e um kwanzas",
            "1100|mil e cem kwanzas",
            "1250|mil duzentos e cinquenta kwanzas",
            "2005|dois mil e cinco kwanzas",
            "25000|vinte e cinco mil kwanzas",
            "331000|trezentos e trinta e um mil kwanzas",
            "357480|trezentos e cinquenta e sete mil quatrocentos e oitenta kwanzas",
            "1000000|um milhão de kwanzas",
            "1000500|um milhão e quinhentos kwanzas",
            "1500000|um milhão e quinhentos mil kwanzas",
            "2200300|dois milhões duzentos mil e trezentos kwanzas",
            "3000000000|três mil milhões de kwanzas",
            "25000.49|vinte e cinco mil kwanzas",
    })
    void extenso(String amount, String expected) {
        assertThat(AmountInWords.kwanzas(new BigDecimal(amount))).isEqualTo(expected);
    }
}
