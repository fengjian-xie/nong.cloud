package com.xiangqiao.platform.security;

import com.xiangqiao.platform.shared.ApiException;

public final class CountyContext {
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private CountyContext() {}

    public static void set(String countyCode) { CURRENT.set(countyCode); }

    public static String required() {
        var code = CURRENT.get();
        if (code == null || code.isBlank()) {
            throw ApiException.badRequest("COUNTY_REQUIRED", "请先选择县域");
        }
        return code;
    }

    public static void clear() { CURRENT.remove(); }
}
