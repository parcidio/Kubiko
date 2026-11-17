package com.beeznoo.api.booking;

import com.beeznoo.api.booking.scheduler.BookingExpiryScheduler;
import com.beeznoo.api.booking.service.BookingService;
import com.beeznoo.api.transaction.scheduler.PaymentExpiryScheduler;
import com.beeznoo.api.transaction.service.PaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Com 2 réplicas da API só uma corre os agendadores (SCHEDULER_ENABLED; docs/DEPLOY_VPS.md). */
class SchedulerToggleTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(BookingService.class, () -> mock(BookingService.class))
            .withBean(PaymentService.class, () -> mock(PaymentService.class))
            .withUserConfiguration(BookingExpiryScheduler.class, PaymentExpiryScheduler.class);

    @Test
    void ligadosPorOmissao() {
        runner.run(ctx -> assertThat(ctx)
                .hasSingleBean(BookingExpiryScheduler.class)
                .hasSingleBean(PaymentExpiryScheduler.class));
    }

    @Test
    void desligadosNaReplicaExtra() {
        runner.withPropertyValues("app.scheduler.enabled=false").run(ctx -> assertThat(ctx)
                .doesNotHaveBean(BookingExpiryScheduler.class)
                .doesNotHaveBean(PaymentExpiryScheduler.class));
    }
}
