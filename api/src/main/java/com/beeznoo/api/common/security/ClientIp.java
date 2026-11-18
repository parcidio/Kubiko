package com.beeznoo.api.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * IP do cliente para limites de pedidos. Só confia nas entradas do X-Forwarded-For acrescentadas pelos
 * `trustedProxies` proxies à frente da API — as da esquerda podem ser inventadas pelo cliente.
 * Ex.: browser → Vercel → Render → API, com trustedProxies = 2: XFF = "cliente, vercel" → "cliente".
 * <p>
 * Lê a N-ésima entrada a contar da direita (N = trustedProxies). Se o cabeçalho tiver menos de N entradas (o pedido
 * não passou pela cadeia toda) ou essa entrada não for um IP, usa o endereço da ligação — nunca uma entrada mais à
 * esquerda. Requisito de alojamento: a API só deve ser alcançável através da cadeia de proxies (docs/SEGURANCA.md).
 */
@Component
public class ClientIp {

    private static final Pattern IPV4 = Pattern.compile(
            "((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)");
    private static final Pattern IPV6 = Pattern.compile("[0-9A-Fa-f:.]{2,45}");

    private final int trustedProxies;

    public ClientIp(SecurityProperties properties) {
        this.trustedProxies = Math.max(0, properties.trustedProxies());
    }

    public String of(HttpServletRequest request) {
        if (trustedProxies == 0) return request.getRemoteAddr();
        List<String> hops = new ArrayList<>();
        // vários cabeçalhos X-Forwarded-For contam como uma lista só, pela ordem em que chegaram
        var headers = request.getHeaders("X-Forwarded-For");
        if (headers != null) {
            for (String header : Collections.list(headers)) {
                if (header == null) continue;
                for (String hop : header.split(",", -1)) hops.add(hop.strip());
            }
        }
        if (hops.size() < trustedProxies) return request.getRemoteAddr();
        String candidate = hops.get(hops.size() - trustedProxies);
        return isIp(candidate) ? candidate : request.getRemoteAddr();
    }

    static boolean isIp(String value) {
        if (value == null || value.isEmpty()) return false;
        if (IPV4.matcher(value).matches()) return true;
        return value.indexOf(':') >= 0 && IPV6.matcher(value).matches();
    }
}
