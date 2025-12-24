class Slideshow {
    constructor() {
        this.slidetimer = null;
        this.transitionTimer = null;
        this.currentSlide = 0;
    }

    init(slideInterval, fadeInterval) {
        if ($('.slideshow').length > 0) {
            this.currentSlide = 0;

            const windowHeight = $(window).outerHeight();
            const headerHeight = $('.navbar').outerHeight();
            const footerHeight = $('footer').outerHeight();
            const creditsHeight = $('.credits').length > 0 ? 20 : 0;
            const reviewCounterHeight = $('.review-counter').length > 0 ? $('.review-counter').outerHeight() + 70 : 50;
            const slideHeight = windowHeight - (headerHeight + footerHeight + reviewCounterHeight + creditsHeight);

            //$('.slideshow .slideshow-slide .share-slide').qrcode({ width: slideHeight, height: slideHeight, text: '@Html.Raw(ViewBag.QRCodeLink)' });

            $('.slideshow').height(slideHeight);
            $('.slideshow .slideshow-slide').each(function (index) {
                $(this).attr('data-slide-index', index);
            });
            $('.slideshow .slideshow-slide[data-slide-index="0"]').show();
                
            clearInterval(this.slidetimer);
            this.slidetimer = setInterval(function () {
                this.currentSlide++;

                if (this.currentSlide >= $('.slideshow .slideshow-slide').length) {
                    $.ajax({
                        type: 'GET',
                        url: `${window.location.pathname}${window.location.search}&partial=true`,
                        success: function (data) {
                            clearInterval(this.slidetimer);
                            clearTimeout(this.transitionTimer);
                            $('#main-gallery').html(data);
                            this.init(slideInterval, fadeInterval);
                        }
                    });
                }

                $('.slideshow-slide').fadeOut(fadeInterval);
                clearTimeout(this.transitionTimer);
                this.transitionTimer = setTimeout(function () {
                    $(`.slideshow-slide[data-slide-index="${this.currentSlide}"]`).fadeIn(fadeInterval);
                }, fadeInterval);
            }, slideInterval);
        }
    }
}

const slideshow = new Slideshow();

export default slideshow;