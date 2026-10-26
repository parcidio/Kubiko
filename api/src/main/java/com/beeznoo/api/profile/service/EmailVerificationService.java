package com.beeznoo.api.profile.service;

import com.beeznoo.api.common.security.RateLimiter;
import com.beeznoo.api.notification.email.EmailTemplateRenderer;
import com.beeznoo.api.notification.email.ResendEmailSender;
import com.beeznoo.api.notification.service.TransactionalEmail;
import com.beeznoo.api.profile.entity.EmailVerification;
import com.beeznoo.api.profile.entity.Profile;
import com.beeznoo.api.profile.repository.EmailVerificationRepository;
import com.beeznoo.api.profile.repository.ProfileRepository;
import com.beeznoo.api.security.entity.SecurityEventType;
import com.beeznoo.api.security.service.SecurityEventService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Verificação de email por código (6 dígitos, 15 min, 5 tentativas). Com o email verificado dos dois lados,
 * o login Google pode associar a conta sem risco de pré-sequestro. Ver claude/decisoes-produto.md.
 */
@Service
public class EmailVerificationService {

    static final Duration TTL = Duration.ofMinutes(15);
    static final int MAX_ATTEMPTS = 5;

    private final EmailVerificationRepository repository;
    private final ProfileRepository profileRepository;
    private final ResendEmailSender sender;
    private final EmailTemplateRenderer renderer;
    private final ApplicationEventPublisher events;
    private final RateLimiter rateLimiter;
    private final SecurityEventService securityEvents;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    public EmailVerificationService(EmailVerificationRepository repository, ProfileRepository profileRepository,
                                    ResendEmailSender sender, EmailTemplateRenderer renderer,
                                    ApplicationEventPublisher events, RateLimiter rateLimiter,
                                    SecurityEventService securityEvents) {
        this.repository = repository;
        this.profileRepository = profileRepository;
        this.sender = sender;
        this.renderer = renderer;
        this.events = events;
        this.rateLimiter = rateLimiter;
        this.securityEvents = securityEvents;
    }

    @Transactional
    public void request(UUID profileId) {
        Profile profile = find(profileId);
        if (profile.getEmail() == null) throw new IllegalArgumentException("Adiciona primeiro um email ao teu perfil.");
        if (profile.getEmailVerifiedAt() != null) throw new IllegalStateException("O teu email já está verificado.");
        if (!sender.isEnabled()) throw new IllegalStateException("O envio de emails ainda não está disponível.");
        rateLimiter.check("email-verify-cooldown:" + profileId, 1, Duration.ofSeconds(60), "Espera um minuto antes de pedir outro código.");
        rateLimiter.check("email-verify-send:" + profileId, 5, Duration.ofHours(1), "Pediste demasiados códigos. Tenta daqui a uma hora.");

        repository.invalidateAll(profileId);
        String code = String.valueOf(100_000 + random.nextInt(900_000));
        EmailVerification verification = repository.save(EmailVerification.builder()
                .profileId(profileId)
                .email(profile.getEmail())
                .codeHash(encoder.encode(code))
                .expiresAt(OffsetDateTime.now().plus(TTL))
                .build());

        String html = renderer.render(firstName(profile.getFullName()), "Confirma o teu email",
                List.of("O teu código Beeznoo é " + code + ".", "É válido durante 15 minutos. Não o partilhes com ninguém."),
                null, null);
        events.publishEvent(new TransactionalEmail(profile.getEmail(), "Código para confirmar o teu email", html,
                verification.getId().toString()));
    }

    // noRollbackFor: o contador de tentativas tem de ficar gravado quando o código está errado
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void confirm(UUID profileId, String code) {
        Profile profile = find(profileId);
        EmailVerification verification = repository.findFirstByProfileIdAndUsedAtIsNullOrderByCreatedAtDesc(profileId)
                .filter(v -> v.getExpiresAt().isAfter(OffsetDateTime.now()))
                .filter(v -> v.getEmail().equalsIgnoreCase(profile.getEmail()))
                .orElseThrow(() -> new IllegalArgumentException("Código inválido ou expirado. Pede um novo."));
        if (verification.getAttempts() >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException("Demasiadas tentativas com este código. Pede um novo.");
        }
        if (!encoder.matches(code, verification.getCodeHash())) {
            verification.setAttempts(verification.getAttempts() + 1);
            throw new IllegalArgumentException("Código incorreto.");
        }
        verification.setUsedAt(OffsetDateTime.now());
        profile.setEmailVerifiedAt(OffsetDateTime.now());
        securityEvents.record(SecurityEventType.EMAIL_VERIFIED, profileId, null, Map.of());
    }

    private Profile find(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Perfil não encontrado"));
    }

    private static String firstName(String fullName) {
        return fullName == null || fullName.isBlank() ? null : fullName.strip().split("\\s+")[0];
    }
}
