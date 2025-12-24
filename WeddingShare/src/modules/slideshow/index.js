class Slideshow {
    constructor() {
        this.slidetimer = null;
        this.transitionTimer = null;
        this.currentSlide = 0;
    }

    init(slideInterval, fadeInterval) {
        if ($('.slideshow').length > 0) {
            this.currentSlide = 0;

            const slideCount = $('.slideshow .slideshow-slide').length;
            if (slideCount > 0) {
                const windowHeight = $(window).outerHeight();
                const headerHeight = $('.navbar').outerHeight();
                const footerHeight = $('footer').outerHeight();
                const creditsHeight = $('.credits').length > 0 ? 20 : 0;
                const reviewCounterHeight = $('.review-counter').length > 0 ? $('.review-counter').outerHeight() + 70 : 50;
                const slideHeight = windowHeight - (headerHeight + footerHeight + reviewCounterHeight + creditsHeight);

                const qrCodeVal = $('.slideshow .slideshow-slide .share-slide').attr('data-value');
                $('.slideshow .slideshow-slide .share-slide').qrcode({ width: slideHeight, height: slideHeight, text: qrCodeVal });

                $('.slideshow').height(slideHeight);
                $('.slideshow .slideshow-slide').each(function (index) {
                    $(this).attr('data-slide-index', index);
                });
                $('.slideshow .slideshow-slide[data-slide-index="0"]').show();

                clearInterval(this.slidetimer);
                this.slidetimer = setInterval(() => {
                    this.currentSlide++;

                    if (this.currentSlide >= slideCount) {
                        $.ajax({
                            type: 'GET',
                            url: `${window.location.pathname}${window.location.search}&partial=true`,
                            success: (data) => {
                                clearInterval(this.slidetimer);
                                clearTimeout(this.transitionTimer);
                                $('#main-gallery').html(data);
                                this.init(slideInterval, fadeInterval);
                            }
                        });
                    }

                    $('.slideshow-slide').fadeOut(fadeInterval);
                    clearTimeout(this.transitionTimer);
                    this.transitionTimer = setTimeout(() => {
                        $(`.slideshow-slide[data-slide-index="${this.currentSlide}"]`).fadeIn(fadeInterval);
                    }, fadeInterval);
                }, slideInterval);
            }
        }
    }
}

const slideshow = new Slideshow();

export default slideshow;